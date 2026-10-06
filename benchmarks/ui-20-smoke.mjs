/** Twenty-finding React operator walk with a synthetic Tauri IPC fixture. */
import { chromium } from "playwright-core";

const findings = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1;
  const technique = ["HOMOGLYPH", "JAMO", "TRANSPARENT", "OFFSCREEN"][index % 4];
  return {
    id: `f${number}`,
    url: `https://example.kr/board/post/${String(Math.floor(index / 4) + 1)}`,
    is_violation: true,
    location: `#ad-${String(number)}`,
    evidence_text: `광고 표현 ${String(number)} 카지노 가입`,
    technique,
  };
});
const timestamp = "2026-10-06T00:00:00.000Z";
const result = {
  meta: { topic: "browser fixture", entry_url: "https://example.kr/", started_at: timestamp,
    finished_at: timestamp, elapsed_sec: 0, tool_version: "0.1.0" },
  findings,
};
const detail = {
  version: 2,
  findings: findings.map((finding) => ({
    findingId: finding.id, url: finding.url, location: finding.location,
    technique: finding.technique, rawText: finding.evidence_text,
    normalizedText: finding.evidence_text, matchedTerms: ["카지노"],
    techniqueReason: "Synthetic UI fixture", observed: {
      box: { x: 10, y: 10, width: 120, height: 40 },
      css: { color: "rgb(0, 0, 0)", backgroundColor: "rgba(0, 0, 0, 0)",
        opacity: "1", display: "block", fontSize: "16px", position: "static" },
    },
    visual: { state: "unavailable", reason: "budget" },
  })),
  coverage: { checkedPages: 6,
    failedPages: [{ url: "https://example.kr/unavailable", status: 404, reason: "HTTP 404" }],
    timedOut: true },
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.addInitScript(({ result, detail }) => {
    const session = { id: "synthetic-20", entryUrl: "https://example.kr/", topic: "",
      status: "succeeded", startedAt: result.meta.started_at, finishedAt: result.meta.finished_at };
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      unregisterCallback: () => {},
      invoke: async (command) => {
        switch (command) {
          case "plugin:event|listen": return 1;
          case "scan_start": case "scan_get_session": return session;
          case "scan_get_result": return result;
          case "scan_get_detail_bundle": return detail;
          case "scan_get_extra_result": return undefined;
          default: throw new Error(`unexpected IPC command ${command}`);
        }
      },
    };
  }, { result, detail });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.getByLabel("점검할 웹사이트").fill("https://example.kr/");
  await page.getByRole("button", { name: "점검 시작" }).click();
  await page.getByText("표시 중인 탐지 20건 / 전체 20건").waitFor({ timeout: 10000 });
  if (await page.locator("button[data-finding-id]").count() !== 20) throw new Error("twenty finding controls missing");
  for (const finding of findings) {
    await page.locator(`button[data-finding-id="${finding.id}"]`).focus();
    await page.keyboard.press("Enter");
    await page.locator(".result-inspector .raw").getByText(finding.evidence_text).waitFor();
    if (finding.id === "f1") await page.screenshot({ path: "/tmp/illegal-ad-v2-inspector-desktop.png" });
    await page.getByRole("button", { name: "검토 완료로 표시" }).click();
  }
  await page.getByRole("button", { name: "결과 목록으로" }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-finding-id") === "f20");
  const reviewed = await page.locator(".finding-card").filter({ hasText: "검토 완료" }).count();
  if (reviewed !== 20) throw new Error(`only ${String(reviewed)} findings show reviewed state`);
  await page.getByLabel("결과 검색").fill("post/1");
  await page.getByLabel("기법 필터").selectOption("HOMOGLYPH");
  await page.getByText("표시 중인 탐지 1건 / 전체 20건").waitFor();
  await page.locator('button[data-finding-id="f1"]').focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("기법 필터").selectOption("JAMO");
  await page.getByRole("button", { name: "결과 목록으로" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "result-search");
  if (await page.getByLabel("결과 검색").inputValue() !== "post/1"
    || await page.getByLabel("기법 필터").inputValue() !== "JAMO") {
    throw new Error("search/filter context lost after twenty-finding review");
  }
  await page.getByRole("button", { name: "결과 저장" }).click();
  const partialNote = await page.getByRole("dialog").getByRole("note").textContent();
  if (!partialNote?.includes("확인 실패 1페이지") || !partialNote.includes("점검 시간 초과")) {
    throw new Error(`partial export warning missing: ${partialNote}`);
  }
  if (await page.getByRole("dialog").getByRole("button", { name: "저장" }).isDisabled()) {
    throw new Error("valid partial result unexpectedly blocked from saving");
  }
  await page.keyboard.press("Escape");
  console.log(JSON.stringify({ fixture: "synthetic Tauri IPC browser replay", findings: 20,
    reviewed, keyboardActivated: 21, retainedSearch: "post/1", retainedFilter: "JAMO",
    fallbackFocus: "result-search", partialExportWarning: true }, null, 2));
} finally {
  await browser.close();
}
