import { vi } from "vitest";
import { chromium } from "playwright-core";

// Explicit opt-in for controlled local fixtures on hosts without usable Linux
// namespaces. Production worker/CLI never imports this file or reads this flag.
// Windows CI leaves it unset to exercise the production isolation configuration.
if (process.env.KRDS_TEST_UNSANDBOXED === "1") {
  const launch = chromium.launch.bind(chromium);
  vi.spyOn(chromium, "launch").mockImplementation((options) => launch({ ...options, chromiumSandbox: false }));
}
