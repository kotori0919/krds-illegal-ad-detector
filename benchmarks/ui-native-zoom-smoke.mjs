/** Headed Chromium 200% zoom smoke; requires Vite on 127.0.0.1:5173. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright-core";

const run = promisify(execFile);
const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  const { stdout } = await run("xdotool", ["search", "--onlyvisible", "--class", "chromium"]);
  const windowId = stdout.trim().split("\n").at(-1);
  if (!windowId) throw new Error("headed Chromium window unavailable");
  await run("xdotool", ["windowfocus", "--sync", windowId]);
  for (let index = 0; index < 5; index += 1) {
    await run("xdotool", ["key", "--window", windowId, "ctrl+plus"]);
  }
  await page.waitForFunction(() => window.devicePixelRatio === 2 && window.innerWidth === 360);

  const widths = {};
  const checkReflow = async (stage) => {
    const width = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      nestedOverflow: [...document.querySelectorAll("*")]
        .filter((element) => !element.classList.contains("sr-only")
          && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)
        .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).split(" ").join(".")}`),
    }));
    widths[stage] = width;
    if (width.document > width.viewport || width.nestedOverflow.length > 0) {
      throw new Error(`${stage} overflows at native 200% zoom: ${JSON.stringify(width)}`);
    }
  };
  await checkReflow("entry");
  await page.getByLabel("점검할 웹사이트").fill("https://example.kr/");
  await page.getByRole("button", { name: "점검 시작" }).click();
  await page.getByText("표시 중인 탐지 5건 / 전체 5건").waitFor({ timeout: 10000 });
  await checkReflow("results");
  const listItems = await page.getByRole("list", { name: "확정된 탐지 목록" }).getByRole("listitem").count();
  if (listItems !== 5) throw new Error(`result list lost semantic findings: ${String(listItems)}`);
  await page.screenshot({ path: "/tmp/illegal-ad-v2-native-zoom-results.png", fullPage: true });
  await page.getByRole("button", { name: "추가 분석" }).click();
  await page.getByText("이 세션에는 추가 분석 결과가 없습니다.").waitFor();
  await checkReflow("extra analysis");
  await page.getByRole("button", { name: "공식 탐지" }).click();
  await page.getByRole("button", { name: "페이지별" }).click();
  await page.getByRole("button", { name: "근거 보기" }).first().click();
  await page.getByRole("heading", { name: "탐지 상세" }).waitFor();
  await checkReflow("inspector");
  const inspector = await page.evaluate(() => ({
    listHidden: getComputedStyle(document.querySelector(".result-workspace-list")).display === "none",
    headingFocused: document.activeElement?.textContent === "탐지 상세",
    focusOutline: document.activeElement ? getComputedStyle(document.activeElement).outlineWidth : "0px",
  }));
  if (!inspector.listHidden || !inspector.headingFocused || inspector.focusOutline !== "3px") {
    throw new Error(`inspector layout/focus: ${JSON.stringify(inspector)}`);
  }
  await page.getByRole("button", { name: "결과 목록으로" }).click();
  await page.getByRole("button", { name: "공식 JSON 저장" }).click();
  await page.getByRole("dialog", { name: "결과 저장" }).waitFor();
  await checkReflow("export dialog");
  const dialogFocused = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  if (!dialogFocused) throw new Error("export dialog focus missing");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger");
  const restoredOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
  if (restoredOutline !== "3px") throw new Error(`export focus ring unavailable: ${restoredOutline}`);
  console.log(JSON.stringify({ zoom: "native Chromium 200%", devicePixelRatio: 2, listItems, widths,
    inspector, dialogFocused, exportFocusRestored: true, restoredOutline }, null, 2));
} finally {
  await browser.close();
}
