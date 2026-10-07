import type { HostBridge, ScanDetailBundle } from "@krds-detector/contracts";
import { indexSessionEvidence } from "../src/host/session-evidence.js";

export function evidenceHost(bundle?: ScanDetailBundle): Pick<HostBridge, "getScanCoverage" | "getFindingDetail" | "getImageAnalysis" | "getEvidenceAsset" | "getEvidenceSummary" | "getEvidenceGraphSlice"> {
  const evidence = bundle && indexSessionEvidence(bundle);
  return {
    getScanCoverage: async () => evidence?.coverage,
    getFindingDetail: async (_sessionId, findingId) => evidence?.findings.get(findingId),
    getImageAnalysis: async (_sessionId, query) => evidence?.imagePage(query),
    getEvidenceAsset: async (_sessionId, assetId) => evidence?.assets.get(assetId),
    getEvidenceSummary: async () => evidence?.summary,
    getEvidenceGraphSlice: async () => undefined,
  };
}
