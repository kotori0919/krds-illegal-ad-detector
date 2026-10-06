/** Benchmark-only timing around the worker's unchanged Playwright capture. */
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(process.argv[1]);
const { chromium } = require("playwright-core");

const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArgs) => {
    const context = await newContext(...contextArgs);
    context.on("page", (page) => {
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async (...captureArgs) => {
        const started = performance.now();
        let ok = false;
        try { const result = await screenshot(...captureArgs); ok = true; return result; }
        finally { console.error("KRDSCAPTURE " + JSON.stringify({ durationMs: performance.now() - started, ok })); }
      };
    });
    return context;
  };
  return browser;
};
