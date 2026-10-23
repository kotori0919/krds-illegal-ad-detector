import type { HostBridge, ScanDetailBundle } from "@krds-detector/contracts";
import { indexSessionEvidence } from "../src/host/session-evidence.js";

export function warpHost(): Pick<HostBridge, "openWarpTerms" | "getWarpStatus" | "registerWarp"> {
  return {
    openWarpTerms: async () => {},
    getWarpStatus: async () => ({ state: "ready", backend: "usque", version: "4.2.1" }),
    registerWarp: async ({ acceptTerms }) => acceptTerms ? { state: "ready", backend: "usque", version: "4.2.1" } : { state: "unavailable", reason: "registration-failed" },
  };
}

export function evidenceHost(bundle?: ScanDetailBundle): Pick<HostBridge, "openWarpTerms" | "getWarpStatus" | "registerWarp" | "getScanCoverage" | "getFindingDetail" | "getImageAnalysis" | "getEvidenceAsset" | "getEvidenceSummary" | "getEvidenceGraphSlice"> {
  const evidence = bundle && indexSessionEvidence(bundle);
  return {
    ...warpHost(),
    getScanCoverage: async () => evidence?.coverage,
    getFindingDetail: async (_sessionId, findingId) => evidence?.findings.get(findingId),
    getImageAnalysis: async (_sessionId, query) => evidence?.imagePage(query),
    getEvidenceAsset: async (_sessionId, assetId) => evidence?.assets.get(assetId),
    getEvidenceSummary: async () => evidence?.summary,
    getEvidenceGraphSlice: async () => undefined,
  };
}
