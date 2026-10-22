import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { SCAN_POLICY } from "@krds-detector/contracts";
import { LocalOcrBackend } from "@krds-detector/evidence";
import { crawlSite, ScanDeadline } from "@krds-detector/scanner";
import { collectPageCreatives } from "../src/creative.js";

function indexedGif(frames: number[][]): Buffer {
  const blocks: Buffer[] = [Buffer.from("GIF89a"), Buffer.from([20, 0, 20, 0, 0x80, 0, 0, 255, 255, 255, 255, 0, 0])];
  for (const pixels of frames) {
    // Reset the tiny LZW dictionary per pixel, keeping fixture codes at 3 bits.
    const codes = [...pixels.flatMap((pixel) => [4, pixel]), 5];
    const compressed = Buffer.alloc(Math.ceil(codes.length * 3 / 8));
    codes.forEach((code, index) => { for (let bit = 0; bit < 3; bit += 1) compressed[(index * 3 + bit) >> 3]! |= ((code >> bit) & 1) << ((index * 3 + bit) & 7); });
    blocks.push(Buffer.from([0x21, 0xf9, 4, 4, 4, 0, 0, 0, 0x2c, 0, 0, 0, 0, 20, 0, 20, 0, 0, 2]));
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.subarray(offset, offset + 255); blocks.push(Buffer.from([block.length]), block);
    }
    blocks.push(Buffer.from([0]));
  }
  return Buffer.concat([...blocks, Buffer.from([0x3b])]);
}

it.each(["frame-cap", "inspection-cap", "unavailable-decoder"] as const)("bounds GIF acquisition and reports fallback honestly: %s", async (scenario) => {
  const blank = Array<number>(400).fill(0);
  const frames = scenario === "inspection-cap"
    ? [...Array.from({ length: SCAN_POLICY.visual.animationFrames }, () => blank), Array.from({ length: 400 }, (_, index) => index % 2)]
    : Array.from({ length: 7 }, (_, frame) => Array.from({ length: 400 }, (_, pixel) => pixel % 20 <= frame * 2 + 1 ? 1 : 0));
  const gif = indexedGif(frames);
  const server = createServer((request, response) => {
    if (request.url === "/banner.gif") {
      response.writeHead(200, { "content-type": "image/gif", "content-length": gif.length }); response.end(gif);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8"); response.end('<img class="ad" src="/banner.gif">');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const deadline = new ScanDeadline(20), address = server.address() as { port: number };
    await crawlSite({ entryUrl: `http://127.0.0.1:${address.port}/`, concurrency: 1, settleMs: 20, deadline,
      limits: { maxPages: 1, timeoutSec: 20 }, onLivePage: async (page, _snapshot, frames, responses) => {
        if (scenario === "unavailable-decoder") await page.evaluate(() => Object.defineProperty(globalThis, "ImageDecoder", { value: undefined }));
        captured = await collectPageCreatives(page, frames, responses, deadline, SCAN_POLICY.visual.bytesPerPage);
      } });
    expect(captured!.coverage.candidatesObserved).toBe(1);
    expect(captured!.bytes).toBeLessThanOrEqual(SCAN_POLICY.visual.bytesPerPage);
    if (scenario === "frame-cap") {
      expect(captured!.images).toHaveLength(SCAN_POLICY.visual.framesPerCandidate);
      expect(new Set(captured!.images.map((image) => image.sha256)).size).toBe(SCAN_POLICY.visual.framesPerCandidate);
      for (const image of captured!.images) expect(image.animationFrame!.timestampMs).toBe(image.animationFrame!.index * 40);
    } else {
      expect(captured!.images).toHaveLength(1);
      if (scenario === "inspection-cap") expect(captured!.images[0]!.animationFrame).toEqual({ index: 0, timestampMs: 0 });
      else {
        expect(captured!.images[0]!.animationFrame).toBeUndefined();
        expect(captured!.images[0]!.candidate.candidateEvidence).toContain("animation-single-frame");
      }
    }
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 25_000);

it("keeps a later readable GIF frame while excluding duplicate blank flashes", async () => {
  const gif = await readFile("fixtures/ocr/animated-offer.gif");
  const server = createServer((request, response) => {
    if (request.url === "/offer.gif") {
      response.writeHead(200, { "content-type": "image/gif", "content-length": gif.length }); response.end(gif);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<img class="ad" src="/offer.gif" width="420" height="100">');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const ocr = new LocalOcrBackend();
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const address = server.address() as { port: number };
    const deadline = new ScanDeadline(30);
    await crawlSite({ entryUrl: `http://127.0.0.1:${address.port}/`, concurrency: 1, settleMs: 20, deadline,
      limits: { maxPages: 1, timeoutSec: 30 }, onLivePage: async (page, _snapshot, frames, responses) => {
        captured = await collectPageCreatives(page, frames, responses, deadline, SCAN_POLICY.visual.bytesPerPage);
      } });
    expect(captured!.coverage.candidatesObserved).toBe(1);
    expect(captured!.images).toHaveLength(1);
    const image = captured!.images[0]!;
    expect(image.animationFrame).toEqual({ index: 1, timestampMs: 40 });
    const recognition = await ocr.recognize({ sourceId: image.sourceUrl, imageBytes: Buffer.from(image.dataUrl.split(",")[1]!, "base64"),
      width: image.width, height: image.height, mediaType: image.mimeType }, 15_000);
    expect(recognition.text.replace(/\s/g, "")).toContain("카지노");
    expect(captured!.prints[0]!.sha256).toBe(image.sha256);
  } finally { await ocr.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 35_000);

it("captures more than eight lazy banners with observed button destinations without clicking controls", async () => {
  const bytes = await readFile("fixtures/ocr/banner.png");
  let clicks = 0;
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/banner.png")) {
      response.writeHead(200, { "content-type": "image/png", "content-length": bytes.length }); response.end(bytes);
    } else if (request.url === "/clicked") { clicks += 1; response.end(); }
    else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(`<!doctype html><style>img{width:420px;height:90px}</style>${Array.from({ length: 24 }, (_, index) =>
        `<button ${index % 2 ? "data-href" : "data-banner-href"}="https://advertiser.invalid/${index}" onclick="fetch('/clicked')"><img id="item-${index}" src="/banner.png?${index}" loading="lazy"></button>`).join("")}
        <button data-banner-href="javascript:alert(1)"><img id="script" src="/banner.png?script"></button>
        <button data-href="https://user:password@advertiser.invalid/"><img id="credentials" src="/banner.png?credentials"></button>
        <div data-href="https://advertiser.invalid/"><img id="ordinary" src="/banner.png?ordinary"></div>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const address = server.address() as { port: number };
    const deadline = new ScanDeadline(40);
    await crawlSite({ entryUrl: `http://127.0.0.1:${address.port}/`, concurrency: 1, settleMs: 20, deadline,
      limits: { maxPages: 1, timeoutSec: 40 }, onLivePage: async (page, _snapshot, frames, responses) => {
        captured = await collectPageCreatives(page, frames, responses, deadline, SCAN_POLICY.visual.bytesPerPage);
      } });
    expect(captured!.images).toHaveLength(24);
    expect(captured!.images.map((image) => image.candidate.destinationUrl)).toEqual(
      Array.from({ length: 24 }, (_, index) => `https://advertiser.invalid/${index}`));
    expect(captured!.images.every((image) => image.candidate.candidateEvidence.includes("external-destination"))).toBe(true);
    expect(captured!.coverage.limitsReached).not.toContain("candidate-limit");
    expect(clicks).toBe(0);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 45_000);

it("normalizes a bounded observed GIF to PNG using its natural pixels", async () => {
  const gif = indexedGif([Array<number>(400).fill(1)]);
  const server = createServer((request, response) => {
    if (request.url === "/banner.gif") {
      response.writeHead(200, { "content-type": "image/gif", "content-length": gif.length }); response.end(gif);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<img class="ad" src="/banner.gif" width="80" height="40">');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  let observedGif = false;
  try {
    const address = server.address() as { port: number };
    const deadline = new ScanDeadline(20);
    await crawlSite({ entryUrl: `http://127.0.0.1:${address.port}/`, concurrency: 1, settleMs: 20, deadline,
      limits: { maxPages: 1, timeoutSec: 20 }, onLivePage: async (page, _snapshot, frames, responses) => {
        observedGif = responses.some((response) => response.mediaType === "image/gif");
        captured = await collectPageCreatives(page, frames, responses, deadline, SCAN_POLICY.visual.bytesPerPage);
      } });
    expect(observedGif).toBe(true);
    expect(captured!.images).toHaveLength(1);
    const image = captured!.images[0]!;
    const png = Buffer.from(image.dataUrl.split(",")[1]!, "base64");
    expect(image).toMatchObject({ width: 20, height: 20, mimeType: "image/png" });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    expect(captured!.prints[0]).toMatchObject({ sha256: image.sha256, mediaType: "image/png" });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 25_000);

it("captures gated IMG, background, SVG and canvas candidates with visible DOM provenance", async () => {
  const bytes = await readFile("fixtures/ocr/banner.png");
  const server = createServer((request, response) => {
    if (request.url?.startsWith("/banner.png")) {
      response.writeHead(200, { "content-type": "image/png", "content-length": bytes.length });
      response.end(bytes);
    } else if (request.url === "/vector") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="90"><image href="data:image/png;base64,${bytes.toString("base64")}" width="420" height="90"/></svg>`;
      response.writeHead(200, { "content-type": "image/svg+xml", "content-length": Buffer.byteLength(svg) });
      response.end(svg);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(`<!doctype html><style>.banner{width:420px;height:90px}.hidden{opacity:0}.nested-hidden{display:none}</style>
        <img id="img-banner" class="banner" src="/banner.png?img">
        <div id="bg-banner" class="banner" style="background-image:url('/banner.png?bg')"></div>
        <svg id="svg-banner" class="banner" xmlns="http://www.w3.org/2000/svg"><image href="/banner.png?svg" width="420" height="90"/><text y="10">SVG fallback</text></svg>
        <img id="external-banner" class="banner" src="/vector">
        <canvas id="canvas-banner" class="banner" width="420" height="90">canvas fallback</canvas>
        <img alt="logo" src="/banner.png?logo"><div style="background-image:url('/banner.png?ordinary');width:100px;height:100px"></div><svg width="32" height="32"><rect width="32" height="32"/></svg><canvas width="32" height="32"></canvas>
        <p><span>카지노 </span><strong>가입 </strong><span>보너스 지급</span><span style="display:none">숨김</span></p><p class="hidden">바카라 가입</p><div class="nested-hidden"><span>토토 가입</span></div>
        <img id="below-banner" class="banner" style="margin-top:1500px" src="/banner.png?below">
        <img id="inline-banner" class="banner" src="data:image/png;base64,${bytes.toString("base64")}">
        <div id="inline-bg-banner" class="banner" style="background-image:url(data:image/png;base64,${bytes.toString("base64")})"></div>
        <script>const image=new Image();image.onload=()=>document.querySelector('#canvas-banner').getContext('2d').drawImage(image,0,0,420,90);image.src='/banner.png?paint';</script>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  const url = `http://127.0.0.1:${address.port}/`;
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const deadline = new ScanDeadline(20);
    await crawlSite({ entryUrl: url, concurrency: 1, settleMs: 100, deadline,
      limits: { maxPages: 1, timeoutSec: 20 },
      onLivePage: async (page, _snapshot, frames, responses) => {
        captured = await collectPageCreatives(page, frames, responses, deadline, 250_000);
      } });
    expect(captured!.images.map((image) => image.sourceUrl).filter((source) => source.includes("?logo") || source.includes("?ordinary"))).toEqual([]);
    expect(captured!.images).toHaveLength(8);
    const candidates = captured!.images.map((image) => image.candidate);
    expect(candidates.map((candidate) => candidate.sourceKind).sort()).toEqual(["background-image", "background-image", "canvas", "img", "img", "img", "svg", "svg"]);
    for (const candidate of candidates) {
      expect(candidate.pageUrl).toBe(url);
      expect(candidate.visibleDomAdTexts).toEqual(["카지노 가입 보너스 지급"]);
    }
    expect(candidates.map((candidate) => candidate.location).sort()).toEqual(["#below-banner", "#bg-banner", "#canvas-banner", "#external-banner", "#img-banner", "#inline-banner", "#inline-bg-banner", "#svg-banner"]);
    for (const image of captured!.images.filter((image) => image.candidate.resourceUrl?.includes("banner.png"))) {
      expect(Buffer.from(image.dataUrl.split(",")[1]!, "base64")).toEqual(bytes);
    }
    const inline = captured!.images.find((image) => image.candidate.location === "#inline-banner")!;
    expect(inline.sourceUrl).toBe(url);
    expect(inline.candidate.resourceUrl).toBeUndefined();
    const inlineBackground = captured!.images.find((image) => image.candidate.location === "#inline-bg-banner")!;
    expect(inlineBackground.sourceUrl).toBe(url);
    expect(inlineBackground.candidate.resourceUrl).toBeUndefined();
    expect(captured!.bytes).toBeLessThanOrEqual(250_000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 20_000);

it("reports the inspected-element bound without guessing candidates beyond it", async () => {
  const server=createServer((_request,response)=>{
    response.setHeader("content-type","text/html; charset=utf-8");
    response.end('<!doctype html>'+"<div></div>".repeat(10_000)+'<canvas class="ad" width="40" height="40"></canvas>');
  });
  await new Promise<void>((done)=>server.listen(0,"127.0.0.1",done));
  const address=server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const deadline=new ScanDeadline(20);
    await crawlSite({entryUrl:`http://127.0.0.1:${address.port}/`,concurrency:1,settleMs:20,deadline,
      limits:{maxPages:1,timeoutSec:20},onLivePage:async(page,_snapshot,frames,responses)=>{
        captured=await collectPageCreatives(page,frames,responses,deadline,250_000);
      }});
    expect(captured!.images).toEqual([]);
    expect(captured!.coverage).toEqual({candidatesObserved:0,limitsReached:["element-limit"],
      skips:[{reason:"element-limit",unit:"document",count:1}]});
  } finally {server.closeAllConnections();await new Promise<void>((done)=>server.close(()=>done()));}
},20_000);

it("does not bypass declared oversized original assets through screenshots", async () => {
  const source = await readFile("fixtures/ocr/banner.png");
  const bytes = Buffer.alloc(250_001); source.copy(bytes);
  const server = createServer((request, response) => {
    if (request.url === "/large.png") {
      response.writeHead(200, { "content-type": "image/png", "content-length": bytes.length });
      response.end(bytes);
    } else {
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end('<img class="ad" src="/large.png" width="420" height="90">');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
  try {
    const deadline = new ScanDeadline(20);
    const summary = await crawlSite({ entryUrl: `http://127.0.0.1:${address.port}/`, concurrency: 1, settleMs: 20, deadline,
      limits: { maxPages: 1, timeoutSec: 20 }, onLivePage: async (page, _snapshot, frames, responses) => {
        await page.locator("img").evaluate((element) => (element as HTMLImageElement).decode());
        captured = await collectPageCreatives(page, frames, responses, deadline, 250_000);
      } });
    expect(summary.pages.map((page) => page.status)).toEqual([200]);
    expect(captured).toMatchObject({ images: [], prints: [], bytes: 0,
      coverage: { candidatesObserved: 1, limitsReached: ["byte-limit"], skips: [{reason:"byte-limit",unit:"candidate",count:1}] } });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 20_000);

it("preserves full frame selectors and stops at candidate, byte and abort bounds", async () => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html; charset=utf-8");
    if (request.url === "/") response.end('<iframe id="outer" src="/outer"></iframe>');
    else if (request.url === "/outer") response.end('<iframe id="inner" src="/inner"></iframe>');
    else response.end(Array.from({ length: SCAN_POLICY.visual.candidatesPerDocument + 2 }, (_, index) => `<canvas id="banner-${index}" width="20" height="20"></canvas>`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  const url = `http://127.0.0.1:${address.port}/`;
  const deadline = new ScanDeadline(20);
  const outputs: Awaited<ReturnType<typeof collectPageCreatives>>[] = [];
  try {
    const summary = await crawlSite({ entryUrl: url, concurrency: 1, settleMs: 20, deadline, limits: { maxPages: 1, timeoutSec: 20 },
      onLivePage: async (page, _snapshot, frames, responses) => {
        outputs.push(await collectPageCreatives(page, frames, responses, deadline, 250_000));
        outputs.push(await collectPageCreatives(page, frames, responses, deadline, 1));
        const controller = new AbortController(); controller.abort();
        outputs.push(await collectPageCreatives(page, frames, responses, deadline, 250_000, controller.signal));
      } });
    expect(summary.pages.map((page) => page.status)).toEqual([200]);
    const [captured, unavailable, cancelled] = outputs;
    expect(captured!.images).toHaveLength(SCAN_POLICY.visual.candidatesPerDocument);
    expect(captured!.coverage.candidatesObserved).toBe(SCAN_POLICY.visual.candidatesPerDocument);
    expect(captured!.coverage.skips).toContainEqual({reason:"candidate-limit",unit:"document",count:1});
    expect(captured!.images[0]!.candidate.location).toBe('#outer >>> #inner >>> #banner-0');
    expect(captured!.images[0]!.candidate.frameUrl).toBe(`${url}inner`);
    expect(captured!.images[0]!.sourceUrl).toBe(url);
    expect(unavailable!.images).toEqual([]);
    expect(unavailable!.bytes).toBe(0);
    expect(cancelled!.images).toEqual([]);
    expect(cancelled!.bytes).toBe(0);
    expect(cancelled!.coverage.skips).toEqual([{reason:"cancelled",unit:"document",count:1}]);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}, 20_000);

it.each([{ file: "brief-gray-offer.gif", frame: 1 }, { file: "brief-late-offer.gif", frame: 4 }, { file: "brief-competing-decoration.gif", frame: 1 }])(
  "retains readable brief text previously lost to thumbnail dedup or global ranking: $file", async ({file,frame}) => {
    const gif = await readFile(`fixtures/ocr/${file}`);
    const server = createServer((request,response) => {
      if (request.url === "/offer.gif") { response.writeHead(200, {"content-type":"image/gif","content-length":gif.length}); response.end(gif); }
      else { response.setHeader("content-type","text/html;charset=utf-8"); response.end('<a href="https://offer.example/"><img class="banner" src="/offer.gif"></a>'); }
    });
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    let captured: Awaited<ReturnType<typeof collectPageCreatives>> | undefined;
    const engine = new LocalOcrBackend();
    try {
      const address = server.address() as {port:number}, deadline = new ScanDeadline(20);
      await crawlSite({entryUrl:`http://127.0.0.1:${address.port}/`,concurrency:1,settleMs:20,deadline,
        limits:{maxPages:1,timeoutSec:20},onLivePage:async(page,_snapshot,frames,responses)=>{
          captured=await collectPageCreatives(page,frames,responses,deadline,SCAN_POLICY.visual.bytesPerPage);
        }});
      const offer=captured!.images.find(image=>image.animationFrame?.index===frame);
      expect(offer).toBeDefined();
      expect(captured!.images.length).toBeLessThanOrEqual(SCAN_POLICY.visual.framesPerCandidate);
      const result=await engine.recognize({sourceId:offer!.sourceUrl,imageBytes:Buffer.from(offer!.dataUrl.split(",")[1]!,"base64"),
        width:offer!.width,height:offer!.height,mediaType:offer!.mimeType});
      expect(result.text.replace(/\s/g,"")).toContain("카지노가입보너스지급");
      if (file === "brief-late-offer.gif") expect(offer!.candidate.candidateEvidence).toContain("animation-partial");
    } finally {await engine.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },25_000);
