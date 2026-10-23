/** BrowserHost interaction smoke. Run Vite on 127.0.0.1:5173 first. */
import { chromium } from "playwright-core";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
try {
  await page.addInitScript(() => window.localStorage.setItem("inspection.uiMode", "advanced"));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const font = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    size: getComputedStyle(document.body).fontSize,
    loaded: [...document.fonts].some((face) =>
      face.family === "Pretendard GOV Variable" && face.status === "loaded"),
  }));
  if (!font.loaded || !font.family.startsWith('"Pretendard GOV Variable"') || font.size !== "17px") {
    throw new Error(`KRDS body font unavailable: ${JSON.stringify(font)}`);
  }
  const entryHeight = await page.getByLabel("점검할 웹사이트").evaluate((input) => input.getBoundingClientRect().height);
  if (entryHeight < 44) throw new Error(`URL entry target below 44px: ${entryHeight}`);
  const scopeDisclosure = page.locator(".advanced > summary").first();
  const disclosureHeight = await scopeDisclosure.evaluate((summary) => summary.getBoundingClientRect().height);
  await scopeDisclosure.click();
  const scopeHeights = await page.locator(".scope-options label").evaluateAll((labels) =>
    labels.map((label) => label.getBoundingClientRect().height));
  if (disclosureHeight < 44 || scopeHeights.some((height) => height < 44)) {
    throw new Error(`scope targets below 44px: ${JSON.stringify({ disclosureHeight, scopeHeights })}`);
  }
  await scopeDisclosure.click();
  if (await page.locator("ol.steps > li").count() !== 3) throw new Error("expected three stages");
  await page.getByLabel("점검할 웹사이트").fill("https://example.kr/");
  await page.getByRole("button", { name: "점검 시작" }).click();
  await page.getByRole("heading", { name: "점검 결과" }).waitFor({ timeout: 10000 });
  await page.getByText("표시 중인 탐지 5건 / 전체 5건").waitFor();
  await page.getByLabel("결과 검색").fill("없는 단어");
  await page.getByText("표시 중인 탐지 0건 / 전체 5건").waitFor();
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();
  await page.getByLabel("결과 검색").fill("Ｋ카지노");
  await page.getByLabel("기법 필터").selectOption("HOMOGLYPH");
  await page.getByText("표시 중인 탐지 1건 / 전체 5건").waitFor();
  await page.getByRole("button", { name: "페이지별" }).click();
  const firstFinding = page.getByRole("button", { name: "근거 보기" }).first();
  await firstFinding.scrollIntoViewIfNeeded();
  const resultScrollY = await page.evaluate(() => scrollY);
  await firstFinding.click();
  await page.getByRole("heading", { name: "탐지 상세" }).waitFor();
  const mobileInspector = await page.evaluate(() => ({
    list: getComputedStyle(document.querySelector(".result-workspace-list")).display,
    inspector: getComputedStyle(document.querySelector(".result-inspector")).display,
    focused: document.activeElement?.textContent,
  }));
  if (mobileInspector.list !== "none" || mobileInspector.inspector === "none" || mobileInspector.focused !== "탐지 상세") {
    throw new Error(`mobile inspector layout/focus: ${JSON.stringify(mobileInspector)}`);
  }
  await page.getByRole("button", { name: "검토 완료로 표시" }).click();
  await page.getByRole("button", { name: "결과 목록으로" }).click();
  await page.waitForFunction((saved) => Math.abs(scrollY - saved) <= 2, resultScrollY);
  await page.getByText("탐지 1건 · 검토 완료 1건").first().waitFor();
  if (await page.getByLabel("결과 검색").inputValue() !== "Ｋ카지노"
    || await page.getByLabel("기법 필터").inputValue() !== "HOMOGLYPH") {
    throw new Error("search/filter context lost after inspection");
  }
  await page.waitForFunction(() => Boolean(document.activeElement?.getAttribute("data-finding-id")), undefined, { timeout: 5000 });
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-finding-id"));
  if (!focused) throw new Error("finding focus was not restored");
  if (await page.locator(".result-files:not([open]) > summary").count()) await page.locator(".result-files > summary").click();
  await page.getByRole("button", { name: "공식 JSON 저장" }).click();
  await page.getByRole("dialog", { name: "결과 저장" }).waitFor();
  const dialogFocused = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  if (!dialogFocused) throw new Error("export dialog did not receive focus");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForFunction(() => document.activeElement?.id === "export-trigger", undefined, { timeout: 5000 });
  const restoredExportFocus = await page.evaluate(() => document.activeElement?.id === "export-trigger");
  if (!restoredExportFocus) throw new Error("export trigger focus was not restored");
  const width = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  if (width.document > width.viewport) throw new Error(`360px overflow: ${JSON.stringify(width)}`);
  await page.mouse.move(0, 0);
  const styles = await page.evaluate(() => {
    const rgb = (value) => [...value.matchAll(/[\d.]+/g)].slice(0, 3).map(([number]) => Number(number) / 255);
    const luminance = (value) => {
      const [r, g, b] = rgb(value).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (fg, bg) => {
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
    };
    const primary = document.querySelector("button.primary");
    const secondary = document.querySelector("button.secondary");
    const hint = document.querySelector(".hint");
    const buttonStyle = getComputedStyle(primary);
    const secondaryStyle = getComputedStyle(secondary);
    return {
      bodyContrast: contrast(getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor),
      primaryContrast: contrast(buttonStyle.color, buttonStyle.backgroundColor),
      secondaryContrast: contrast(secondaryStyle.color, secondaryStyle.backgroundColor),
      hintContrast: contrast(getComputedStyle(hint).color, getComputedStyle(document.body).backgroundColor),
      primaryHeight: primary.getBoundingClientRect().height,
      primaryFill: buttonStyle.backgroundColor,
    };
  });
  if ([styles.bodyContrast, styles.primaryContrast, styles.secondaryContrast, styles.hintContrast].some((ratio) => ratio < 4.5)) {
    throw new Error(`text contrast below 4.5: ${JSON.stringify(styles)}`);
  }
  if (styles.primaryHeight < 44) throw new Error(`primary target below 44px: ${styles.primaryHeight}`);
  await page.screenshot({ path: "/tmp/illegal-ad-v2-results-360.png", fullPage: true });
  await page.setViewportSize({ width: 720, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const doubled = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  if (doubled.document > doubled.viewport) throw new Error(`2x CSS zoom overflow: ${JSON.stringify(doubled)}`);
  await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "근거 보기" }).first().click();
  const desktopInspector = await page.evaluate(() => {
    const list = document.querySelector(".result-workspace-list").getBoundingClientRect();
    const detail = document.querySelector(".result-inspector").getBoundingClientRect();
    return { listRight: list.right, detailLeft: detail.left, listVisible: list.width > 0, detailVisible: detail.width > 0 };
  });
  if (!desktopInspector.listVisible || !desktopInspector.detailVisible || desktopInspector.listRight >= desktopInspector.detailLeft) {
    throw new Error(`desktop inspector not beside list: ${JSON.stringify(desktopInspector)}`);
  }
  await page.getByRole("button", { name: "결과 목록으로" }).click();
  console.log(JSON.stringify({ stages: 3, font, entryHeight, disclosureHeight, scopeHeights, visibleFindings: 5, searchReset: true, mobileInspector, desktopInspector, restoredScrollY: resultScrollY, focusRestoredTo: focused, dialogFocused, restoredExportFocus, width, styles, cssZoom2x: doubled }, null, 2));
} finally {
  await browser.close();
}
