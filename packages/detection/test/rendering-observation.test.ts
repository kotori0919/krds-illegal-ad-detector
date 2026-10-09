import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, expect, it } from "vitest";
import { collectElementSignals } from "../src/visibility.js";
import { SCAN_POLICY } from "@krds-detector/contracts";
import { observeFrameOwner } from "../../scanner/src/observation.js";

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ chromiumSandbox: true }); });
afterAll(async () => { await browser?.close(); });

it("uses alpha, composited backgrounds, text ranges and ancestor clipping with visible controls", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<body style="background:white">
      <p id="alpha" style="color:rgba(255,0,0,0)">카지노 가입</p>
      <p id="fill" style="-webkit-text-fill-color:transparent">카지노 가입</p>
      <p id="shadow" style="color:transparent;text-shadow:1px 1px black">카지노 가입</p>
      <p id="stroke" style="color:white;-webkit-text-stroke:1px black">카지노 가입</p>
      <p id="background" style="color:white">카지노 가입</p>
      <div style="background:rgb(30,40,50)"><p id="composite" style="color:rgb(30,40,50);background:rgba(30,40,50,.4)">카지노 가입</p></div>
      <p id="clip" style="clip-path:inset(50%)">카지노 가입</p>
      <div style="overflow:hidden;height:10px"><p id="overflow" style="margin-top:30px">카지노 가입</p></div>
      <span id="contents" style="display:contents">카지노 가입</span>
      <p id="visible" style="color:rgba(255,0,0,.5)">카지노 가입</p>
      <p id="partial" style="clip-path:inset(0 50% 0 0)">카지노 가입</p>
      <p id="below" style="margin-top:2000px">카지노 가입</p>
      <div style="background:linear-gradient(white,black)"><p id="unknown" style="color:white">카지노 가입</p></div>
    </body>`);
    const ids = ["alpha", "fill", "shadow", "stroke", "background", "composite", "clip", "overflow", "contents", "visible", "partial", "below", "unknown"];
    const signals = await page.evaluate(collectElementSignals, { inputs: ids.map((id) => ({ selector: `#${id}`, rawText: "카지노 가입" })), limits: SCAN_POLICY.visibility });
    const byId = new Map(signals.map((signal) => [signal.selector.slice(1), signal]));
    for (const id of ["alpha", "fill", "background", "composite"]) expect(byId.get(id)?.transparent, id).toBe(true);
    for (const id of ["shadow", "stroke"]) expect(byId.get(id)?.transparent, id).toBe(false);
    for (const id of ["clip", "overflow"]) expect(byId.get(id)?.offscreen, id).toBe(true);
    for (const id of ["contents", "visible", "partial", "below"]) {
      expect(byId.get(id)?.offscreen, id).toBe(false); expect(byId.get(id)?.transparent, id).toBe(false);
    }
    expect(byId.get("unknown")?.transparent).toBe(false);
    expect(byId.get("unknown")?.renderingIssues).toContain("non-solid background or compositing");
  } finally { await page.close(); }
});

it("propagates observed owner-frame concealment without inventing child CSS", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<p id="ad">카지노 가입</p>');
    const [signal] = await page.evaluate(collectElementSignals, { inputs: [{ selector: "#ad", rawText: "카지노 가입" }], limits: SCAN_POLICY.visibility,
      frameVisibility: { transparent: true, offscreen: true, transparentDetail: "owner opacity:0", offscreenDetail: "owner fully clipped" } });
    expect(signal?.transparent).toBe(true); expect(signal?.offscreen).toBe(true);
    expect(signal?.transparentDetail).toContain("frame ancestor: owner opacity:0");
    expect(signal?.css.opacity).toBe("1");
  } finally { await page.close(); }
});

it("observes tiny clipping of larger glyph ranges across font metrics without flagging unclipped or scrollable text", async () => {
  const page = await browser.newPage();
  try {
    for (const font of ["Arial", "serif", "monospace", '"Noto Sans CJK KR"']) {
      await page.setContent(`<body style='font-family:${font}'>
        <p id="tiny" style="width:2px;height:2px;overflow:hidden;line-height:0">바카라 실시간 쿠폰 지급중</p>
        <p id="clip-path" style="width:100px;height:30px;clip-path:inset(0 98px 28px 0);line-height:0">바카라 쿠폰 지급</p>
        <p id="unclipped" style="width:2px;height:2px;overflow:visible;line-height:0">바카라 쿠폰 지급</p>
        <span id="contents" style="display:contents">바카라 쿠폰 지급</span>
        <p id="tiny-font" style="font-size:2px">작은 글자 안내</p>
        <div style="overflow:auto;width:160px;height:30px"><p id="scroll" style="margin:0">바카라 실시간 쿠폰 지급중 추가 안내</p></div>
        <p id="partial" style="width:100px;height:30px;clip-path:inset(0 50% 0 0)">바카라 쿠폰 지급</p>
      </body>`);
      const signals = await page.evaluate(collectElementSignals, { inputs: ["tiny", "clip-path", "unclipped", "contents", "tiny-font", "scroll", "partial"].map(id => ({ selector: `#${id}`, rawText: "바카라 쿠폰 지급" })), limits: SCAN_POLICY.visibility });
      const byId = new Map(signals.map(signal => [signal.selector.slice(1), signal]));
      for (const id of ["tiny", "clip-path"]) {
        expect(byId.get(id)?.offscreen, `${font} ${id}`).toBe(true);
        expect(byId.get(id)?.offscreenDetail).toMatch(/text ranges (fully clipped|clipped to at most)/);
      }
      for (const id of ["unclipped", "contents", "tiny-font", "scroll", "partial"]) expect(byId.get(id)?.offscreen, `${font} ${id}`).toBe(false);
    }
  } finally { await page.close(); }
});

it("propagates an observed tiny frame-owner intersection while retaining naturally small owner controls", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div style="width:2px;height:2px;overflow:hidden"><iframe id="clipped" style="width:100px;height:30px;border:0"></iframe></div><iframe id="small" style="width:2px;height:2px;border:0"></iframe>');
    const clipped = await page.locator("#clipped").evaluate(observeFrameOwner, SCAN_POLICY.visibility);
    const small = await page.locator("#small").evaluate(observeFrameOwner, SCAN_POLICY.visibility);
    expect(clipped.offscreen).toBe(true);
    expect(clipped.offscreenDetail).toContain("frame owner clipped from 100x30 to 2x2 CSS px");
    expect(small.offscreen).toBe(false);
  } finally { await page.close(); }
});
