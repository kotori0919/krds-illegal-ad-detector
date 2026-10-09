import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, expect, it } from "vitest";
import { collectElementSignals } from "../src/visibility.js";
import { SCAN_POLICY } from "@krds-detector/contracts";

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
