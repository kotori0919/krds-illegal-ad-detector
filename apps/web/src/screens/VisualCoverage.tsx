import type { VisualAnalysisCoverage } from "@krds-detector/contracts";

const reasonLabels: Record<string, string> = {
  "page-limit": "이미지 수집 페이지 수 제한", "candidate-limit": "문서별 후보 수 제한",
  "element-limit": "문서별 요소 확인 수 제한", "byte-limit": "페이지별 이미지 용량 제한",
  "ocr-image-limit": "서로 다른 문자 인식 이미지 수 제한", deadline: "공통 제한 시간 도달",
  cancelled: "점검 중지", "capture-error": "이미지 촬영 실패", "document-unavailable": "문서 확인 불가",
  "image-unavailable": "이미지 분석 사용 불가", "target-unavailable": "촬영할 요소 확인 불가",
};
const unitLabels = { page: "페이지", document: "문서", candidate: "후보", image: "이미지" };

export function VisualCoverage({ coverage }: { coverage?: VisualAnalysisCoverage }) {
  if (!coverage) return <p role="status">이 기록에는 측정된 이미지 분석 범위가 없습니다. 전체 후보 수와 이미지 분석 완료 여부는 알 수 없습니다.</p>;
  return <>
    <p>페이지 점검 완료와 이미지·문자 인식 완료는 서로 다릅니다. 전체 이미지 후보 수는 알 수 없습니다.</p>
    <dl className="evidence">
      <div><dt>이미지 수집을 고려한 페이지</dt><dd>{coverage.pagesConsidered}개 · 고려하지 않은 것으로 기록된 페이지 {coverage.pagesNotConsidered}개</dd></div>
      <div><dt>실제로 관측한 후보</dt><dd>{coverage.candidatesObserved}개 · 전체 후보 수 알 수 없음</dd></div>
      <div><dt>수집한 이미지</dt><dd>{coverage.imagesAcquired}개 · 저장된 이미지 분석 기록 {coverage.imageAnalysisRecords}건</dd></div>
      <div><dt>서로 다른 OCR 이미지</dt><dd>시도 {coverage.ocrImagesAttempted}개 · 완료 {coverage.ocrImagesCompleted}개 · 분석 불가 {coverage.ocrImagesUnavailable}개</dd></div>
    </dl>
    {coverage.limitsReached.length ? <p role="status">일부 이미지는 설정된 제한으로 분석하지 못했을 수 있습니다. 도달한 제한: {coverage.limitsReached.map((reason) => reasonLabels[reason] ?? reason).join(" · ")}</p>
      : <p>기록된 설정 제한 도달 없음. 확인하지 않은 요소의 분석 여부는 알 수 없습니다.</p>}
    {coverage.skips.length ? <><p>제한에 도달한 문서 수는 기록된 관측값입니다. 확인하지 않은 이미지 후보 수를 추정한 값이 아닙니다.</p><ul aria-label="이미지 분석 제외 및 실패 사유">{coverage.skips.map((skip) => <li key={`${skip.reason}-${skip.unit}`}>
      {reasonLabels[skip.reason] ?? skip.reason} · {unitLabels[skip.unit]} {skip.count}개
    </li>)}</ul></> : <p>기록된 이미지 분석 제외·실패 없음.</p>}
    <details className="advanced"><summary>이미지 분석의 설정 제한</summary>
      <p>수집 페이지 {coverage.limits.pages}개 · 문서별 후보 {coverage.limits.candidatesPerDocument}개 · 문서별 요소 {coverage.limits.elementsPerDocument}개 · 페이지별 {coverage.limits.bytesPerPage.toLocaleString("ko-KR")}바이트 · 서로 다른 OCR 이미지 {coverage.limits.distinctOcrImages}개</p>
    </details>
  </>;
}
