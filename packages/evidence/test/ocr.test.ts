import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { LocalOcrBackend } from "../dist/ocr.js";

it("recognizes Korean advertising text from actual image bytes offline", async () => {
  const engine = new LocalOcrBackend();
  try {
    const result = await engine.recognize({ sourceId: "banner", imageBytes: await readFile("fixtures/ocr/banner.png"),
      width: 800, height: 150, mediaType: "image/png" }, 8000);
    expect(result.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(result.confidence).toBeGreaterThan(0.8);
  } finally { await engine.close(); }
}, 12_000);

it("settles cancellation without starting recognition or leaving a worker alive", async () => {
  const engine = new LocalOcrBackend();
  const controller = new AbortController();
  controller.abort();
  try {
    await expect(engine.recognize({ sourceId: "cancelled", imageBytes: new Uint8Array(),
      width: 800, height: 150, mediaType: "image/png" }, 8000, controller.signal)).rejects.toThrow("OCR budget exhausted");
  } finally { await engine.close(); }
});

it("reads the deposit and comp offer in the archived real banner that sparse OCR missed", async () => {
  const engine = new LocalOcrBackend();
  try {
    const result = await engine.recognize({ sourceId: "archived-real-banner", imageBytes: await readFile("fixtures/real-banners/blacktoon-7.png"),
      width: 206, height: 62, mediaType: "image/png" }, 8000);
    const text = result.text.replace(/\s/g, "");
    expect(text).toContain("페이백10%");
    expect(text).toContain("콤프3.5%");
    expect(text).toContain("입금");
    expect(result.backend).toBe("ppocrv5-korean-mobile-cpu-v1");
  } finally { await engine.close(); }
}, 12_000);

it("continues with the next banner after one corrupt candidate fails", async () => {
  const engine = new LocalOcrBackend();
  try {
    await expect(engine.recognize({ sourceId: "corrupt", imageBytes: new Uint8Array([1, 2, 3]),
      width: 10, height: 10, mediaType: "image/png" }, 8000)).rejects.toThrow("OCR recognition failed");
    const result = await engine.recognize({ sourceId: "following-banner", imageBytes: await readFile("fixtures/ocr/banner.png"),
      width: 800, height: 150, mediaType: "image/png" }, 8000);
    expect(result.text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
  } finally { await engine.close(); }
}, 20_000);

it("terminates an active OCR worker when cancellation interrupts startup", async () => {
  const engine = new LocalOcrBackend();
  const controller = new AbortController();
  const crop = { sourceId: "active", imageBytes: await readFile("fixtures/ocr/banner.png"),
    width: 800, height: 150, mediaType: "image/png" };
  const pending = engine.recognize(crop, 8000, controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(pending).rejects.toThrow("OCR budget exhausted");
  await engine.close();
  await expect(engine.recognize(crop)).rejects.toThrow("OCR engine closed");
});

it("keeps the host alive through warmed OCR deadlines, recovery and cancellation", async () => {
  const engine = new LocalOcrBackend();
  const crop = { sourceId: "warm-neural", imageBytes: await readFile("fixtures/real-banners/blacktoon-7.png"),
    width: 206, height: 62, mediaType: "image/png" };
  try {
    expect((await engine.recognize(crop, 8000)).backend).toBe("ppocrv5-korean-mobile-cpu-v1");
    await expect(engine.recognize(crop, 10)).rejects.toThrow("OCR budget exhausted");
    const recovered = await engine.recognize(crop, 8000);
    expect(recovered.text.replace(/\s/g, "")).toContain("콤프3.5%");
    const controller = new AbortController();
    const cancelled = engine.recognize(crop, 8000, controller.signal);
    const timer = setTimeout(() => controller.abort(), 10);
    try { await expect(cancelled).rejects.toThrow("OCR budget exhausted"); }
    finally { clearTimeout(timer); }
    await expect(engine.recognize(crop)).rejects.toThrow("OCR engine closed");
  } finally { await engine.close(); }
}, 25_000);

it("uses actual text embeddings, preserves normal/public text and recovers after a native deadline", async () => {
  const engine = new LocalOcrBackend();
  try {
    const positive = await engine.analyzeText("사설 도박 사이트의 첫충, 페이백, 콤프와 롤링 혜택 광고");
    expect(positive.state).toBe("available");
    if (positive.state === "available") {
      expect(positive.positiveSimilarity).toBeGreaterThan(0.999);
      expect(positive.margin).toBeGreaterThan(0.1);
      expect(positive.passed).toBe(true);
    }
    const normal = await engine.analyzeText("공식 쇼핑몰의 제품 구매 할인, 회원 가입 쿠폰과 무료 배송 광고");
    expect(normal.state === "available" && normal.passed).toBe(false);
    for (const text of [
      "토익\n\n점수 벌크업\n\n점수 벌크업\n\n해커스\n\n[개\n\n4\n\n토익점수상승\n\n조패 무\n\n8\n\nSST\n\n료배포\n\nLo 해:\n\n토(\n\noy\n\n지금 참여하기\n\nFei\n\nEi\n\n2B\n\n=\n",
      "커스자격증\n\n전기기사\n\n/\n\nsam\n\n최대\n\n30096\n\n환급반\n\n몬브로\n\n자세히보기\n\n초시생전!    rosa\n\n환기\n\nHERR\n\nRE 4\n",
    ]) {
      const education = await engine.analyzeText(text);
      expect(education.state).toBe("available");
      expect(education.state === "available" && education.passed).toBe(false);
    }
    const disguised = await engine.analyzeText("토익 교재 무료배포 카지노 바카라 첫충 40% 신규 가입 입금 보너스");
    expect(disguised.state === "available" && disguised.passed).toBe(true);
    const itemCode = await engine.analyzeText("BLACKBIRDHERE\n입력시\n교환코드\n프로필 테두리 보상 획득 가능");
    expect(itemCode).toMatchObject({ state: "available", policy: "text-ad-embedding-v3", passed: false });
    const gamblingCode = await engine.analyzeText("게임 아이템 교환코드 광고 카지노 바카라 첫충 40% 입금 환전 보너스");
    expect(gamblingCode.state === "available" && gamblingCode.passed).toBe(true);
    expect(await engine.analyzeText("<|video|> 도박 광고")).toEqual({ state: "unavailable", reason: "invalid-input" });
    expect(await engine.analyzeText("가".repeat(4097))).toEqual({ state: "unavailable", reason: "invalid-input" });
    await expect(engine.analyzeText("사설 도박 사이트의 첫 입금 보너스", 1)).rejects.toThrow("OCR budget exhausted");
    const recovered = await engine.analyzeText("불법 도박과 카지노 광고를 신고하고 피해를 예방하라는 공공 교육 안내");
    expect(recovered.state === "available" && recovered.passed).toBe(false);
    const controller = new AbortController();
    const pending = engine.analyzeText("사설 도박 사이트의 첫 입금 보너스", 8000, controller.signal);
    await Promise.resolve(); controller.abort();
    await expect(pending).rejects.toThrow("OCR budget exhausted");
    await expect(engine.analyzeText("정상 광고")).rejects.toThrow("OCR engine closed");
  } finally { await engine.close(); }
}, 25_000);

it("retains OCR when the optional model assets are missing without retrying initialization", async () => {
  const { mkdir, mkdtemp, cp, symlink, rm } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  await mkdir("artifacts", { recursive: true });
  const directory = await mkdtemp(resolve("artifacts/text-embedding-missing-model-"));
  await cp("packages/evidence/dist/ocr.js", `${directory}/ocr.mjs`);
  await cp("packages/evidence/dist/ocr-diagnostics.js", `${directory}/ocr-diagnostics.js`);
  await cp("packages/evidence/dist/ocr-worker.mjs", `${directory}/ocr-worker.mjs`);
  await rm(`${directory}/ocr-data`, { force: true });
  await symlink(resolve("packages/evidence/dist/ocr-data"), `${directory}/ocr-data`, "dir");
  const { LocalOcrBackend: IsolatedBackend } = await import(pathToFileURL(`${directory}/ocr.mjs`).href);
  const engine = new IsolatedBackend();
  try {
    const crop = { sourceId: "baseline", imageBytes: await readFile("fixtures/ocr/banner.png"), width: 800, height: 150, mediaType: "image/png" };
    expect((await engine.recognize(crop)).text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
    expect(await engine.analyzeText("페이백10% 입금 가능")).toEqual({ state: "unavailable", reason: "model-error" });
    expect(await engine.analyzeText("첫충100% 입금 가능")).toEqual({ state: "unavailable", reason: "model-error" });
    expect((await engine.recognize(crop)).text.replace(/\s/g, "")).toContain("카지노가입보너스지급");
  } finally { await engine.close(); await rm(directory, { recursive: true, force: true }); }
}, 15_000);

it("preserves primary OCR while a bounded small-banner pass recovers actual lost percentages", async () => {
  const engine = new LocalOcrBackend();
  try {
    const crop={sourceId:"actual-mt-888asia",imageBytes:await readFile("fixtures/real-banners/mt-888asia.png"),width:147,height:40,mediaType:"image/png"};
    const primary=await engine.recognize(crop);
    expect(primary.text).not.toContain("40%");
    const alternative=await engine.recognize({...crop,variant:"small-banner"});
    expect(alternative.text).toContain("40%15%");
    expect(alternative.backend).toBe("ppocrv5-korean-mobile-4x-cpu-v2");
    expect((await engine.recognize(crop)).text).toBe(primary.text);
  } finally {await engine.close();}
},15_000);

it("recovers the missing exam context despite a high average Tesseract confidence", async () => {
  const engine=new LocalOcrBackend();
  try {
    const crop={sourceId:"actual-exam-fee-ad",imageBytes:await readFile("fixtures/real-banners/ybm-exam-fee.png"),width:550,height:400,mediaType:"image/png"};
    const primary=await engine.recognize(crop);
    expect(primary.backend).toBe("tesseract-cpu-kor-eng-v7");
    expect(primary.confidence).toBeGreaterThanOrEqual(.7);
    expect(primary.text).not.toContain("토익");
    const verified=await engine.recognize({...crop,variant:"neural-review"});
    expect(verified.backend).toBe("ppocrv5-korean-mobile-cpu-v1");
    expect(verified.text.replace(/\s/g,"")).toContain("토익응시료1만원할인");
    const comparison=await engine.analyzeText(verified.text);
    expect(comparison.state).toBe("available");
    expect(comparison.state==="available"&&comparison.passed).toBe(false);
  } finally {await engine.close();}
},15_000);

it("warms the shared engines once and keeps warm-up time out of analysis evidence", async () => {
  const engine = new LocalOcrBackend();
  try {
    await engine.warm(8000);
    const started = performance.now();
    const evidence = await engine.analyzeText("사설 도박 사이트의 첫충, 페이백, 콤프와 롤링 혜택 광고");
    expect(evidence.state).toBe("available");
    // Warm-up already paid initialization, so this call is analysis only.
    expect(performance.now() - started).toBeLessThan(4000);
    expect(evidence.state === "available" && evidence.elapsedMs).toBeLessThan(1500);
  } finally { await engine.close(); }
}, 30_000);

it("excludes cold engine initialization from the reported analysis window", async () => {
  const engine = new LocalOcrBackend();
  try {
    const started = performance.now();
    const evidence = await engine.analyzeText("사설 도박 사이트의 첫충, 페이백, 콤프와 롤링 혜택 광고", 8000);
    const wallMs = performance.now() - started;
    expect(evidence.state).toBe("available");
    const elapsedMs = evidence.state === "available" ? evidence.elapsedMs : Number.NaN;
    // A cold worker pays the encoder from disk inside wall time, never inside elapsedMs.
    expect(wallMs - elapsedMs).toBeGreaterThan(500);
    expect(elapsedMs).toBeLessThan(1500);
  } finally { await engine.close(); }
}, 30_000);

it("bounds warm-up by its own timeout and recovers on the next request", async () => {
  const engine = new LocalOcrBackend();
  try {
    await expect(engine.warm(1)).rejects.toThrow("OCR budget exhausted");
    await engine.warm(8000);
    expect((await engine.analyzeText("정상 광고")).state).toBe("available");
  } finally { await engine.close(); }
}, 30_000);

