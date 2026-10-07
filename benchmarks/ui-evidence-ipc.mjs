/** Replay the product's lazy evidence projection, without the old bundle IPC. */
import { build } from "esbuild";
import { Buffer } from "node:buffer";

async function loadSource(path) {
  const output = await build({ entryPoints: [path], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`);
}
const [{ indexSessionEvidence }, { sliceEvidenceGraph }] = await Promise.all([
  loadSource(new URL("../apps/web/src/host/session-evidence.ts", import.meta.url).pathname),
  loadSource(new URL("../packages/evidence/src/graph.ts", import.meta.url).pathname),
]);

const indexes = new WeakMap();
export function evidenceRead(detail, command, args = {}) {
  if (!detail) return undefined;
  let evidence = indexes.get(detail);
  if (!evidence) { evidence = indexSessionEvidence(detail); indexes.set(detail, evidence); }
  switch (command) {
    case "scan_get_coverage": return evidence.coverage;
    case "scan_get_finding_detail": return evidence.findings.get(args.findingId);
    case "scan_get_image_analysis": return evidence.imagePage(args.query);
    case "scan_get_evidence_asset": return evidence.assets.get(args.assetId);
    case "scan_get_evidence_summary": return evidence.summary;
    case "scan_get_evidence_graph_slice": return evidence.graph ? sliceEvidenceGraph(evidence.graph, args.query) : undefined;
    default: throw new Error(`unexpected evidence command ${command}`);
  }
}

export async function installResultReplay(page, { result, detail, extra, session, beforeRead, exportReplay }) {
  const reads = [];
  await page.exposeFunction("resultReplayInvoke", async (command, args) => {
    reads.push({ command, args });
    await beforeRead?.(command, args);
    switch (command) {
      case "plugin:event|listen": return 1;
      case "plugin:event|unlisten": return;
      case "scan_start": case "scan_get_session": return session;
      case "scan_get_result": return result;
      case "scan_get_extra_result": return extra;
      case "scan_export":
        if (!exportReplay) throw new Error("export replay not configured");
        return exportReplay(args);
      default: return evidenceRead(detail, command, args);
    }
  });
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = { transformCallback: () => 1, unregisterCallback: () => {},
      invoke: (command, args) => window.resultReplayInvoke(command, args) };
  });
  return reads;
}
