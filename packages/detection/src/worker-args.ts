import { SCAN_POLICY, validateScanConfiguration } from "@krds-detector/contracts";

export interface WorkerArgs {
  session: string; entryUrl: string; maxPages: number; maxDepth: number; maxFrameDepth: number;
  timeoutSec: number; settleMs: number; concurrency: number;
  executablePath?: string; channel?: string; outFile?: string; detailOutFile?: string; extraOutFile?: string;
  publicNetworkOnly: boolean; entryKind: "site" | "sitemap";
}
const valueFlags = ["--session", "--entry-url", "--max-pages", "--max-depth", "--max-frame-depth", "--timeout-sec", "--settle-ms", "--concurrency",
  "--executable-path", "--channel", "--out-file", "--detail-out-file", "--extra-out-file", "--entry-kind"];

/** A single, bounded CLI input boundary. Unknown/duplicate flags never become policy overrides. */
export function parseWorkerArgs(argv: readonly string[]): WorkerArgs {
  if (argv.length > 32) throw new Error("Too many worker arguments");
  const values = new Map<string, string>();
  let publicNetworkOnly = false;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]!;
    if (values.has(flag) || (flag === "--public-network-only" && publicNetworkOnly)) throw new Error("Duplicate worker flag");
    if (flag === "--public-network-only") { publicNetworkOnly = true; continue; }
    if (!valueFlags.includes(flag)) throw new Error("Unknown worker flag");
    const value = argv[++index];
    if (!value || value.startsWith("--") || value.length > 8192 || /[\0\r\n]/.test(value)) throw new Error("Missing or unsafe worker argument value");
    values.set(flag, value);
  }
  const session = values.get("--session") ?? "";
  const entryUrl = values.get("--entry-url") ?? "";
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(session) || !entryUrl) throw new Error("usage: scanner-worker --session <id> --entry-url <http(s) URL>");
  let url: URL;
  try { url = new URL(entryUrl); } catch { throw new Error("Invalid worker entry URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Worker entry URL must use http(s) without credentials");
  const number = (flag: string, fallback: number): number => {
    const text = values.get(flag);
    if (text === undefined) return fallback;
    if (!/^\d+$/.test(text)) throw new Error("Worker limits must be non-negative decimal integers");
    return Number(text);
  };
  const defaults = SCAN_POLICY.scan.defaults;
  const config = validateScanConfiguration({ configVersion: 1,
    limits: { maxPages: number("--max-pages", defaults.maxPages), maxDepth: number("--max-depth", defaults.maxDepth),
      maxFrameDepth: number("--max-frame-depth", defaults.maxFrameDepth), timeoutSec: number("--timeout-sec", defaults.timeoutSec) },
    settleMs: number("--settle-ms", SCAN_POLICY.scan.settleMs.default),
    concurrency: number("--concurrency", SCAN_POLICY.scan.concurrency.default) }, "worker");
  if (!config.ok) throw new Error(config.errors.join("; "));
  const entryKind = values.get("--entry-kind") ?? "site";
  if (entryKind !== "site" && entryKind !== "sitemap") throw new Error("--entry-kind must be site or sitemap");
  const channel = values.get("--channel");
  if (channel && !["chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge", "msedge-beta", "msedge-dev", "msedge-canary"].includes(channel)) throw new Error("Unsupported installed-browser channel");
  return { session, entryUrl, ...config.value.limits, settleMs: config.value.settleMs, concurrency: config.value.concurrency,
    executablePath: values.get("--executable-path"), channel, outFile: values.get("--out-file"), detailOutFile: values.get("--detail-out-file"),
    extraOutFile: values.get("--extra-out-file"), publicNetworkOnly, entryKind };
}
