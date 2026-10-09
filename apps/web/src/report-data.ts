import type { HostBridge, ImageAnalysis } from "@krds-detector/contracts";
import type { ReportSession, ReviewRecord } from "@krds-detector/evidence/report";

/** Same persisted session as official JSON export; optional read failures are
 * named in the report rather than silently presented as zero coverage. */
export async function readReportSession(host: HostBridge, sessionId: string, reviews: ReviewRecord[] = []): Promise<ReportSession> {
  const official = await host.getOfficialResult(sessionId);
  if (!official) throw new Error("저장된 공식 결과를 불러오지 못했습니다.");
  const result: ReportSession = { sessionId, official, reviews, unavailable: [] };
  try {
    const saved = await host.openCase(sessionId);
    result.savedCase = { caseId: saved.manifest.caseId, directory: saved.directory, policyVersion: saved.manifest.policyVersion, reviewRevision: saved.review.revision };
    if (!reviews.length) result.reviews = saved.review.records;
  } catch { result.unavailable!.push("케이스 보관 정보 조회 불가; 현재 화면의 검토 기록을 사용함"); }
  const reads = await Promise.allSettled([host.getScanCoverage(sessionId), host.getExtraResult(sessionId), host.getEvidenceSummary(sessionId)]);
  const coverage = reads[0]!, extra = reads[1]!, summary = reads[2]!;
  if (coverage.status === "fulfilled" && coverage.value) result.coverage = coverage.value;
  else result.unavailable!.push("점검 범위 기록 없음 또는 조회 실패");
  if (extra.status === "fulfilled" && extra.value) result.extra = extra.value;
  else result.unavailable!.push("추가 탐지 기록 없음 또는 조회 실패");
  if (summary.status === "fulfilled" && summary.value) result.summary = summary.value;
  else result.unavailable!.push("근거 요약 없음 또는 조회 실패");
  const analyses: ImageAnalysis[] = [];
  let cursor: number | undefined = 0;
  try {
    for (let pageCount = 0; cursor !== undefined && pageCount < 64; pageCount++) {
      const page = await host.getImageAnalysis(sessionId, { cursor, limit: 24 });
      if (!page) { result.unavailable!.push("이미지 문자 분석 기록 없음"); cursor = undefined; break; }
      analyses.push(...page.items);
      if (page.nextCursor !== undefined && page.nextCursor <= cursor) throw new Error("invalid image cursor");
      cursor = page.nextCursor;
    }
    if (cursor !== undefined) throw new Error("image analysis page limit");
    result.imageAnalysis = analyses;
  } catch { result.unavailable!.push("이미지 문자 분석 조회 실패 또는 일부 기록만 조회됨"); result.imageAnalysis = analyses; }
  return result;
}
