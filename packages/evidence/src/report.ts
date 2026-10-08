import ExcelJS from "exceljs";
import { techniqueLabel, scanIssueLabel, discoverySourceLabel, type ExtraResult, type ImageAnalysis, type OfficialResult, type ScanCoverageView, type EvidenceSummary, type VisualAnalysisReason } from "@krds-detector/contracts";
import { groupReviewPatterns } from "./review-patterns.js";

export interface ReviewRecord {
  findingId: string;
  state: "needed" | "reviewed";
  note: string;
  at: string;
}

export interface ReportSession {
  sessionId: string;
  label?: string;
  official: OfficialResult;
  coverage?: ScanCoverageView;
  extra?: ExtraResult;
  summary?: EvidenceSummary;
  imageAnalysis?: ImageAnalysis[];
  reviews?: ReviewRecord[];
  unavailable?: string[];
}
export interface ReportTarget {
  key: string; label: string; entryUrl: string; status: string; sessionId?: string; reason?: string;
}

const CELL_LIMIT = 32_767;
const CELL_SUFFIX = "\n[일부 생략: 원문은 공식 JSON 참조]";
function text(value: unknown): string {
  const raw = String(value ?? "").replace(/\p{Cc}/gu, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13 ? "�" : character;
  });
  return raw.length <= CELL_LIMIT ? raw : raw.slice(0, CELL_LIMIT - CELL_SUFFIX.length) + CELL_SUFFIX;
}

function sheet(book: ExcelJS.Workbook, name: string, headings: string[], widths: number[]): ExcelJS.Worksheet {
  const result = book.addWorksheet(name);
  result.columns = headings.map((heading, index) => ({ header: heading, width: widths[index] ?? 24 }));
  result.views = [{ state: "frozen", ySplit: 1 }];
  result.getRow(1).font = { bold: true };
  result.getRow(1).height = 28;
  return result;
}

/** Every untrusted field is assigned a string value, never a formula,
 * hyperlink, rich-text expression, or external relationship. */
function row(target: ExcelJS.Worksheet, values: unknown[]): void {
  const item = target.addRow(values.map((value) => value instanceof Date ? value : typeof value === "number" ? value : text(value)));
  item.alignment = { vertical: "top", wrapText: true };
  item.eachCell((cell) => { if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd hh:mm:ss"; });
}

function date(raw: string): Date | string {
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : raw;
}
const reviewLabel = (review?: ReviewRecord): string => review?.state === "reviewed" ? "검토 완료" : "검토 필요";
const visualReasonLabels: Record<VisualAnalysisReason, string> = {
  "page-limit": "이미지 수집 페이지 수 제한", "candidate-limit": "문서별 후보 수 제한",
  "element-limit": "문서별 요소 확인 수 제한", "byte-limit": "페이지별 이미지 용량 제한",
  "ocr-image-limit": "서로 다른 문자 인식 이미지 수 제한", deadline: "공통 제한 시간 도달",
  cancelled: "점검 중지", "capture-error": "이미지 촬영 실패", "document-unavailable": "문서 확인 불가",
  "image-unavailable": "이미지 분석 사용 불가", "target-unavailable": "촬영할 요소 확인 불가",
};
const visualUnitLabels = { page: "페이지", document: "문서", candidate: "후보", image: "이미지" };

export async function createOperationalWorkbook(sessions: readonly ReportSession[], options: { targets?: readonly ReportTarget[] } = {}): Promise<Uint8Array> {
  if (!sessions.length || sessions.length > 100 || (options.targets?.length ?? 0) > 100 || sessions.reduce((count, session) => count + session.official.findings.length, 0) > 100_000) {
    throw new Error("보고서 범위를 초과했습니다. 사이트별 보고서를 저장해 주세요.");
  }
  const book = new ExcelJS.Workbook();
  book.creator = "KRDS Illegal Ad Detector";
  const summary = sheet(book, "점검 요약", ["세션", "항목", "내용"], [24, 30, 80]);
  const groups = sheet(book, "반복 항목", ["세션", "업무용 묶음 번호", "관측 문구", "기법명", "공식 기법 코드", "기록 수", "영향 페이지 수", "기록된 링크 주소", "대표 기록", "검토 상태", "범례"], [24, 30, 50, 20, 20, 14, 18, 60, 20, 24, 60]);
  const details = sheet(book, "탐지 상세", ["세션", "원본 기록 번호", "페이지 주소", "원문", "공식 기법 코드", "기법명", "정확한 요소 위치", "검토 상태", "사람의 검토 메모"], [24, 20, 65, 80, 20, 20, 80, 20, 60]);
  const coverage = sheet(book, "페이지·점검 범위", ["세션", "요청 주소", "최종 주소", "점검 상태", "HTTP 상태", "미점검 사유", "발견 경로"], [24, 65, 65, 24, 14, 70, 24]);
  const extra = sheet(book, "추가 분석", ["세션", "분석 종류", "기록 번호", "관련 주소", "관측 원문", "관측·파생 구분", "설명"], [24, 30, 24, 65, 80, 30, 70]);
  const reviews = sheet(book, "검토 기록", ["세션", "원본 기록 번호", "사람의 검토 상태", "메모", "기록 시각 (UTC)", "보관 범위"], [24, 20, 24, 80, 26, 65]);
  const targets = options.targets || sessions.length > 1 ? sheet(book, "대상 요약", ["세션", "사이트명", "시작 주소", "원본 탐지 수", "영향 페이지 수", "확인 페이지 수", "실패 페이지 수", "일괄 대상 번호", "진행 상태", "미완료 사유"], [24, 30, 65, 18, 20, 20, 20, 18, 24, 65]) : undefined;
  for (const session of sessions) {
    const { official } = session;
    const officialIds = new Set(official.findings.map((finding) => finding.id));
    const byId = new Map((session.reviews ?? []).map((review) => [review.findingId, review]));
    const addSummary = (key: string, value: unknown): void => row(summary, [session.sessionId, key, value]);
    addSummary("시작 주소", official.meta.entry_url);
    if (session.label) addSummary("운영자 지정 사이트명", session.label);
    addSummary("점검 시작 (UTC)", date(official.meta.started_at)); addSummary("점검 종료 (UTC)", date(official.meta.finished_at));
    addSummary("경과 시간 (초)", official.meta.elapsed_sec); addSummary("공식 탐지 기록 수", official.findings.length);
    addSummary("탐지된 페이지 수", new Set(official.findings.map((finding) => finding.url)).size);
    addSummary("성공적으로 확인한 페이지", session.coverage?.coverage.checkedPages ?? "알 수 없음");
    addSummary("실패한 페이지", session.coverage?.coverage.failedPages.length ?? "알 수 없음");
    addSummary("점검 범위", !session.coverage ? "범위 기록 없음; 탐지 페이지 수로 점검 범위를 추정하지 않음"
      : session.coverage.coverage.cancelled ? "중지 전 일부 결과" : session.coverage.coverage.timedOut ? "제한 시간 도달; 일부 결과" : "저장된 점검 범위 참조; 전체 사이트 점검을 보장하지 않음");
    const visual = session.summary?.visualAnalysisCoverage;
    if (!visual) addSummary("이미지 분석 범위", "측정 기록 없음; 알 수 없음");
    else {
      addSummary("이미지 분석 범위", "페이지 점검 완료와 이미지·문자 인식 완료는 서로 다릅니다. 전체 이미지 후보 수는 알 수 없습니다.");
      addSummary("이미지 수집을 고려한 페이지 수", visual.pagesConsidered);
      addSummary("이미지 수집을 고려하지 않은 것으로 기록된 페이지 수", visual.pagesNotConsidered);
      addSummary("실제로 관측한 이미지 후보 수", visual.candidatesObserved);
      addSummary("전체 이미지 후보 수", "알 수 없음");
      addSummary("수집한 이미지 수", visual.imagesAcquired);
      addSummary("저장된 이미지 분석 기록 수", visual.imageAnalysisRecords);
      addSummary("문자 인식을 시도한 서로 다른 이미지 수", visual.ocrImagesAttempted);
      addSummary("문자 인식을 완료한 서로 다른 이미지 수", visual.ocrImagesCompleted);
      addSummary("문자 인식이 불가한 서로 다른 이미지 수", visual.ocrImagesUnavailable);
      addSummary("이미지 수집 페이지 수 제한", visual.limits.pages);
      addSummary("문서별 이미지 후보 수 제한", visual.limits.candidatesPerDocument);
      addSummary("문서별 요소 확인 수 제한", visual.limits.elementsPerDocument);
      addSummary("페이지별 이미지 용량 제한 (바이트)", visual.limits.bytesPerPage);
      addSummary("서로 다른 문자 인식 이미지 수 제한", visual.limits.distinctOcrImages);
      addSummary("이미지 분석에서 도달한 제한", visual.limitsReached.length
        ? visual.limitsReached.map((reason) => visualReasonLabels[reason]).join(" · ")
        : "기록된 설정 제한 도달 없음; 확인하지 않은 요소의 분석 여부는 알 수 없음");
      if (visual.skips.length) {
        addSummary("이미지 분석 제외·실패 해석", "제외·실패 건수는 기록된 관측값이며 확인하지 않은 이미지 후보 수를 추정한 값이 아닙니다.");
        visual.skips.forEach((skip, index) => addSummary(`이미지 분석 제외·실패 ${index + 1}`, `${visualReasonLabels[skip.reason]} · ${visualUnitLabels[skip.unit]} ${skip.count}개`));
      } else addSummary("이미지 분석 제외·실패", "기록된 이미지 분석 제외·실패 없음");
    }
    addSummary("보고서 범례", "반복 묶음은 UI/업무 관리용 파생 정보이며 공식 결과가 아닙니다. 자동 탐지는 법적 위반 확정이 아닙니다. 검토 완료는 사람의 검토 표시이며 조치 완료가 아닙니다.");
    addSummary("원문·날짜·링크 제한", "전체 탐지 집합을 저장합니다. 셀은 32,767자 이내로 제한하며 생략·제어문자 치환 시 원문은 공식 JSON에 보존됩니다. 날짜는 UTC입니다. 주소는 안전한 복사 가능한 텍스트로 저장하며 수식·활성 링크는 생성하지 않습니다.");
    addSummary("검토 보관 범위", "검토 상태와 메모는 현재 앱 화면 메모리에 보관되며 이 보고서에 복사됩니다. 앱 다시 시작 후 복원을 보장하지 않습니다.");
    if (session.unavailable?.length) addSummary("보고서 제한", session.unavailable.join("; "));
    for (const pattern of groupReviewPatterns(official.findings)) {
      const count = pattern.findings.filter((finding) => byId.get(finding.id)?.state === "reviewed").length;
      row(groups, [session.sessionId, pattern.id, pattern.summary, techniqueLabel[pattern.technique], pattern.technique, pattern.findings.length,
        pattern.pageUrls.length, pattern.destination ?? "미관측", pattern.findings[0]?.id,
        count === pattern.findings.length ? "검토 완료" : `검토 필요 (완료 ${count}/${pattern.findings.length})`, "UI/관리 파생 묶음; 링크 주소는 요소 위치 기록에서 읽음"]);
    }
    for (const finding of official.findings) {
      const review = byId.get(finding.id);
      row(details, [session.sessionId, finding.id, finding.url, finding.evidence_text, finding.technique, techniqueLabel[finding.technique], finding.location, reviewLabel(review), review?.note ?? ""]);
    }
    if (!session.coverage) row(coverage, [session.sessionId, official.meta.entry_url, "", "알 수 없음", "", "저장된 점검 범위 기록 없음", "알 수 없음"]);
    else if (session.coverage.pageOutcomes.length) for (const outcome of session.coverage.pageOutcomes) {
      row(coverage, [session.sessionId, outcome.url, outcome.finalUrl, outcome.issue ? scanIssueLabel[outcome.issue.kind] : outcome.outcome === "checked" ? "확인 완료" : "미점검", outcome.status,
        outcome.reason ?? "", outcome.discoverySource ? discoverySourceLabel[outcome.discoverySource] : "알 수 없음"]);
    } else {
      row(coverage, [session.sessionId, official.meta.entry_url, "", "페이지별 기록 없음", "", `확인 ${session.coverage.coverage.checkedPages}개; 개별 확인 페이지를 추정하지 않음`, "알 수 없음"]);
      for (const failure of session.coverage.coverage.failedPages) row(coverage, [session.sessionId, failure.url, "", "미점검", failure.status, failure.reason, "알 수 없음"]);
    }
    for (const finding of session.extra?.findings ?? []) row(extra, [session.sessionId, finding.extra_finding, finding.id, finding.url, finding.evidence_text,
      "추가 분석 (공식 4기법과 별도)", finding.location]);
    for (const analysis of session.imageAnalysis ?? []) row(extra, [session.sessionId, "이미지 문자 인식", analysis.analysisId ?? "", analysis.sourceUrl,
      analysis.ocr.state === "available" ? analysis.ocr.text : "인식 불가", "수집 이미지의 OCR 파생 문자",
      `${analysis.ocr.state === "unavailable" ? analysis.ocr.reason : analysis.decision.detail}; 페이지 ${analysis.pageUrls.join(", ")}`]);
    for (const relation of session.summary?.infrastructure ?? []) row(extra, [session.sessionId, "광고 연관 인프라", "", relation.domain,
      relation.pageUrls.join("\n"), "관측 관계의 파생 요약", "공동 소유 또는 법적 위반을 증명하지 않음"]);
    if (!session.extra && !session.imageAnalysis) row(extra, [session.sessionId, "알 수 없음", "", "", "", "분석 기록 없음", "추가 분석 완료 또는 탐지 없음으로 해석하지 마세요."]);
    for (const review of session.reviews ?? []) {
      if (officialIds.has(review.findingId)) row(reviews, [session.sessionId, review.findingId, reviewLabel(review), review.note, date(review.at), "현재 화면의 로컬 사람 판단; 이 보고서에 복사됨"]);
    }
    if (targets && !options.targets) row(targets, [session.sessionId, session.label ?? "", official.meta.entry_url, official.findings.length,
      new Set(official.findings.map((finding) => finding.url)).size, session.coverage?.coverage.checkedPages ?? "알 수 없음", session.coverage?.coverage.failedPages.length ?? "알 수 없음"]);
  }
  if (targets && options.targets) {
    const bySession = new Map(sessions.map((session) => [session.sessionId, session]));
    for (const target of options.targets) {
      const session = target.sessionId ? bySession.get(target.sessionId) : undefined;
      row(targets, [target.sessionId ?? "", target.label, target.entryUrl, session?.official.findings.length ?? "알 수 없음",
        session ? new Set(session.official.findings.map((finding) => finding.url)).size : "알 수 없음",
        session?.coverage?.coverage.checkedPages ?? "알 수 없음", session?.coverage?.coverage.failedPages.length ?? "알 수 없음",
        target.key, target.status, target.reason ?? ""]);
    }
  }
  for (const sheet of book.worksheets) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  const buffer = await book.xlsx.writeBuffer();
  if (buffer.byteLength > 24 * 1024 * 1024) throw new Error("보고서 파일이 너무 큽니다. 사이트별로 저장해 주세요.");
  return new Uint8Array(buffer);
}
