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
        let bytes = 0;
        try {
          if (process.env.KRDS_BENCH_CAPTURE_UNAVAILABLE === "1") throw new Error("benchmark injected unavailable capture");
          const result = await screenshot(...captureArgs); bytes = result.length; ok = true; return result;
        }
        finally { console.error("KRDSCAPTURE " + JSON.stringify({ durationMs: performance.now() - started, ok, bytes })); }
      };
    });
    return context;
  };
  return browser;
};
