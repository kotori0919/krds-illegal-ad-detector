import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { crawlSite, ScanDeadline } from "@krds-detector/scanner";
import { collectPageCreatives } from "../src/creative.js";

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
    else response.end(Array.from({ length: 10 }, (_, index) => `<canvas id="banner-${index}" width="20" height="20"></canvas>`).join(""));
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
    expect(captured!.images).toHaveLength(8);
    expect(captured!.coverage.candidatesObserved).toBe(8);
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
