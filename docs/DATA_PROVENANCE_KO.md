# 데이터·모델 출처 인덱스

경로는 저장소 루트 기준이다. 출처 URL·SHA 기록과 재배포 허락은 별개다. 이 정리는 원본 데이터·gold·threshold·모델 가중치를 바꾸거나 삭제하지 않는다. 외부 광고 사이트 재접속·이미지 신규 수집도 하지 않았다. 첫 당사자 코드/직접 작성 자료의 프로젝트 라이선스는 소유자 미선택이며 이 문서가 임의의 라이선스를 부여하지 않는다.

| 구분 | 경로·출처 기록 | 사용/권리 한계 |
| --- | --- | --- |
| 직접 작성 텍스트·DOM | `fixtures/synthetic/`, `fixtures/realistic/`의 HTML/ground-truth; `packages/detection/test/fixtures/adult-evaluation/{cases,holdout}.json` 및 [corpus README](../packages/detection/test/fixtures/adult-evaluation/README.md) | authored 성인 fixture는 text-only이며 실제 성인 매체/광고 접속 없음. cases는 개발 회귀로 승격, holdout도 같은 작성자의 유한 표본. 외부 독립 평가 아님 |
| OCR 합성/파생 GIF | `fixtures/ocr/brief-offer-provenance.json` | `OWNED_DERIVED_NOT_ADVERTISER_ORIGINAL`로 기록한 GIF는 실제 송출 원본이 아님. 표시 프레임/지연/SHA·재현 식별자를 보존 |
| 실제 화면 crop·파생 배너 | `fixtures/real-banners/manifest.json`, `lowres-review-provenance.json`, `ybm-exam-fee-provenance.json`, `ocr-regressions.json` | BlackToon screenshot crop, KCI crop, LG 축소본, YBM 정상 광고 등. 원본 resource와 crop/reencode/축소를 혼동하지 않음. synthetic controls도 섞여 있으므로 개별 source/kind를 확인. 공개 URL만으로 재배포 허락을 입증하지 않으며 별도 허락 미확인 |
| 기타 이미지 fixture | `fixtures/ocr/{banner.png,animated-offer.gif}`, `fixtures/realistic/ads/` 등 위 provenance에 개별 결속되지 않은 자산 | 출처·변환·재배포 권리 추가 확인 필요. 디렉터리 이름만으로 자체 제작/권리 확보라고 분류하지 않음 |
| 임베딩 참조 | `packages/evidence/src/text-embedding-model/{text-references,image-references}.json`, `scripts/prepare-embedding-references.mjs` | 텍스트20/이미지52 참조의 model/policy/reference 해시와 입력 식별자 보존. 실제/파생 이미지 기반 벡터를 포함하며 참조 세트는 평가 holdout이 아님. 입력 이미지의 이용 허락까지 모델 Apache 라이선스로 대체되지 않음 |
| 정제 시험 결과 | `packages/evidence/test/fixtures/sample_result_617_sanitized.json` | 정제된 회귀 입력. 원본 실사이트의 모든 개인정보 제거 또는 모든 이미지 내 민감정보 부재를 보증하는 기록은 아님. 공개 공유 전 별도 검토 필요 |
| 실행/역사 증거 | `docs/validation/historical-evidence/`, `docs/validation/r2-evidence/` 및 PROVENANCE/identity JSON | 당시 해시·로그·범위를 보존. 현재 후보 전체 합격이나 데이터 사용 허락으로 해석하지 않음 |

## 고정 모델과 동봉 고지

| 자산 | revision/전체 SHA의 기준 | 동봉 라이선스·고지 |
| --- | --- | --- |
| PP-OCRv5 mobile ONNX 검출/한국어 인식 | [OCR manifest](../packages/evidence/src/ocr-models/manifest.json): RapidAI/RapidOCR `v3.10.0`, 파일별 URL/bytes/SHA-256 및 vocabulary 해시 | `packages/evidence/src/ocr-models/{PaddleOCR,RapidOCR}-LICENSE.txt`, Apache-2.0 |
| Tesseract kor/eng | `package-lock.json`의 `@tesseract.js-data/{kor,eng}` 1.0.0, `4.0.0_best_int`; npm integrity와 `scripts/windows-runtime.lock.json`의 배포 SHA | `packages/evidence/src/ocr-models/Tesseract-LICENSE.txt`. npm metadata의 MIT와 upstream traineddata Apache-2.0 기록을 구별 ([빌드 설명](BUILD_MANUAL.md)) |
| EmbeddingGemma 2 FP32 text / INT8 weight-only vision | [embedding manifest](../packages/evidence/src/text-embedding-model/manifest.json): ONNX revision `daa72c51243991dfcaf9f9137d2c573d8f7790c0`, 6개 파일별 URL/bytes/전체 SHA-256 | 같은 디렉터리 `LICENSE.txt`, `NOTICE.txt` (Apache-2.0, Google DeepMind/ONNX conversion). 오디오/비디오 encoder 미동봉 |
| 화면 폰트/실행 의존성 | `apps/web/src/assets/PretendardGOV-LICENSE.txt`, npm/Cargo lock, `scripts/windows-runtime.lock.json` | 별도 third-party license와 패키징 SBOM/notices 확인. 종속성 라이선스를 프로젝트 자체 라이선스로 간주하지 않음 |

모델은 최초 빌드에서만 준비하고, 준비된 자산은 매 게시 시 크기·전체 SHA를 확인한다. 가중치·캐시·개인 사례·자격정보·큰 빌드 결과는 이번 PR 커밋에 포함하지 않는다. 모델 고정과 라이선스 동봉은 법률 검토나 모든 재배포 권한의 최종 승인과 다르다. 원본 광고 데이터의 허락 미확인 항목은 소유자의 별도 확인 대상으로 남긴다.
