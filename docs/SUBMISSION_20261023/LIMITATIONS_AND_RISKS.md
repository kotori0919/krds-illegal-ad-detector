# 한계와 위험

> 제품 `dd5ceb4`, source `8628ba4a4488…`, 서명 없는 gnullvm 내부 평가 후보.
> Windows에서 NIA 5페이지·실패 0, 공개 두 대상 저장·재시작 복원·통합 XLSX·Excel 열람을 확인했다.
> JS/TS 770 passed / 1 skipped, 최종 native 82 passed / 0 failed / 2 ignored. 전체 E2E·제출 완료 표시는 아니다.

이 문서는 해결됐다고 주장하지 않는 항목을 정리한다. 각 항목은 **무엇인지 / 왜
중요한지 / 완화·다음 단계** 순서다. 수치는 모두 출처 절을 함께 적었다. 검증 수치의
범위는 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md), 절차는
[`BUILD_AND_RUN.md`](BUILD_AND_RUN.md), 제품 개요는
[`APPLICATION_SUMMARY.md`](APPLICATION_SUMMARY.md)를 따른다.

## 1. D08 — 판단·메모를 포함한 공개 두 대상 수용은 미실행

최종8628ba4a 설치본에서 공개 NIA·정부24 두 대상의 독립 사례 저장2/2,
정상 종료·새 프로세스 복원2/2, 동일 caseId·complete/blocked 상태·정확한 페이지 카운터,
통합 XLSX7시트의 전후 모든 셀 동일과 실제 Excel 열람을 확인했다.
정부24는 `plus.gov.kr` 외부 이동으로 미점검이며 성공 점검으로 바꾸지 않았다.

두 대상의 탐지가0건이므로 판단·메모를 포함한 두 대상 통합 보고서 수용은 NOT_RUN이다.
소유 loopback 단일 양성의17탐지·f13 메모·suspected·reviewed는 새 설치본에서 복원됐고,
원본과 같은 JSON 및 검토 기록을 포함한 XLSX·Excel 열람도 확인했다. 이 보충 증거를
두 대상 양성 수용으로 합치지 않는다. 기기 간 그룹 이식도 NOT_RUN이다.

이전0361562d의 NIA 진입 누락·D08 저장 실패는43c6ff5/3598f48로 수정했다.
중간70a599fb에서 발견한 복원 카드 카운터0도 dd5ceb4로 수정해 최종 설치본에서 확인했다.
검증기를 완화하지 않았으며 과거 실패 그룹과 공식 원본은 보존했다.
실행은 `artifacts/dogfood-20261023/resumed-windows/`, 파일·환경·수치는
[VERIFICATION_SUMMARY.md](VERIFICATION_SUMMARY.md) §4를 따른다.

## 2. 실사이트 이미지 광고 재현율

- **무엇인지**: 2026-10-14 블랙툰 실사이트 점검에서 공식 탐지는 1건이었고, 그 1건은
  보이는 배너가 아니라 `display:none` 조상 아래 숨은 내비게이션 문구(`OFFSCREEN`)였다.
  당시 이미지 분석은 후보 8개 확보·OCR 6건 수행·상한으로 2건 제외였고, `첫충70%`를
  읽은 1건은 독립 보강 근거가 없어 2/3으로 보류됐다. 이후 수집 상한을 32후보·40 OCR로
  확대했으나 그 변경 후의 실사이트 재현율은 측정하지 않았다. 남은 누락도 문서화되어
  있다(극단 축소 파생 1건, 저해상도 소형 배너 일부, `WINNER`·`MACHUJA` 계열 로고·
  저해상도 표현).
- **왜 중요한지**: 공모전 평가의 핵심 축이 실제 사이트 탐지이고, 이미지형 배너가 주요
  매체이기 때문이다. 회귀 자료의 높은 숫자를 모집단 정확도로 읽으면 안 된다.
- **완화·다음 단계**: 확장 상한 적용 후 실사이트 표본을 다시 측정하고, 누락 유형을
  OCR·임베딩 단계별로 분류한다. 회귀 자료(190입력, 29묶음)는 **이전 소스 `f481d73`에서
  같은 `inputs.json`(sha256 `eb1572b6…e8ad3`)으로 다시 측정한 결과** 실제 출처 불법 배너
  60/60, 실제 정상 광고 오탐 **0/74**, 파생 양성 17/18, 파생 정상 오탐 **0/38**이다.
  판정이 바뀐 7행은 v4 검토→v3 규칙으로 강화된 양성이고, 남은 누락은 파생 BUTTER 1건이다.
  이는 개발·회귀 자료이며 법적 위반 확정률이 아니다. EasyOCR·Korean TrOCR 비교에서 TrOCR은
  알려진 정상 입력 3/10 오탐으로 기각됐다.
- **Windows 범위**: `e54fe63`에서 강화한 이미지 광고 규칙(정산 앵커 `가입코드`/`테더`/
  `usdt`, `첫충(?!전)`)은 **Windows 설치본에서 실행되지 않았다.** synthetic fixture가 배너·
  추가 단서 0건을 내기 때문이다. Windows v3 관측은 *변하지 않은* 17개 문자 탐지의
  무회귀까지이며, 이미지 규칙의 근거는 위 Linux 재측정이다.
- 근거: `docs/PLANNING_DOC.md` §12, `docs/DOGFOOD_LEDGER_20261014.md`,
  `docs/EMBEDDING_QUANTIZATION_20261022.md`, `docs/VISION_CPU_OPTIMIZATION_20261022.md`,
  `docs/OCR_ENGINE_COMPARISON_20261021.md`, `docs/ADR/0017-...md` §Alternatives and limits.

## 3. Cold-start 임베딩 예산 동작 (부분 완화)

- **무엇인지**: Linux 2 CPU 고정·page cache evict 조건에서 첫 text 임베딩은 3.65초
  (상한·production timeout 8초), 첫 image 임베딩은 11.4초(상한·timeout 16초)였다.
  인위적 3배 oversubscription에서 text 5.5~6.0초, image 18.5~46.7초를 관측했다(MEASURED).
  **`953ce2c`가 이 중 초기화 시간을 `elapsedMs`에서 제외했다**: `analyzeAfterInit` seam이
  엔진 resolve 뒤에 타이머를 시작하고, `scanSite`가 분석 1회 예산(8초) 상한으로 1회
  warm-up하며(`{warm:true}` 프로토콜, 잔여 500ms 미만이면 생략, 실패 시
  `embedding-warm:budget|error` 기록 후 계속) warm-up 시간을 증거 측정에서 뺀다.
  warm-up으로 측정된 cold init은 **idle 0.83–0.9초 / 2배 이상 과부하 2.0–2.7초**다.
- **왜 중요한지**: 이전에는 느린 하드웨어의 첫 근거가 `budget`으로 탈락할 수 있었다.
  탈락은 fail-closed여서 **오탐은 만들지 않지만**, 이미지만 있는 광고를 놓칠 수 있다.
- **남은 위험**: warm-up은 초기화 비용만 제거한다. **2.5배 이상 oversubscription에서
  image 추론 자체가 16초 상한을 넘을 수 있는 문제는 그대로**이며, 이번에 수정하지 않은
  선행 관측이다(18.5~46.7초). 그 경우에도 fail-closed로 예산 탈락이 기록된다.
- **완화·다음 단계**: 예산 탈락 사유를 점검 범위·추가 분석 화면에서 확인하고 필요하면
  재점검한다. 저사양 실측(4~6코어·8GB·무GPU)에서 첫 실행 시간을 다시 측정한다.
- 근거: `docs/ADOPTION_LEDGER.md` §「실측 잔여 위험」, §「2026-10-23 통합 검증과 최종
  후보」, `953ce2c` commit message(측정값 원문).

## 4. 설치 크기 712.34 MiB와 pruning 이후 남은 payload

- **무엇인지**: 현재 후보 installer는 `746,947,332` B(712.34 MiB)이고 sha256은
  `33ce86950fe11ef2dc2e210c60e6604797c2a2ffb4c8e222f4c28a0015b36d56`이다. 모델 약 1.31 GB와
  스테이징 `node_modules` 약 153 MB를 포함한다. `1c0e8a3`이 `onnxruntime-node`에서
  `bin/napi-v6/win32/x64`(binding DLL + 로더/라이선스)만 staging하고 타 플랫폼 바이너리를
  제거했다. 스테이징 `node_modules`는 376 MB → 153 MB(−233,962,380 B)이고 lock은
  1197 → 1177 항목이다. 이 staging 비교는 pruning 당시의 역사 측정이며 현재 후보의
  기능·속도 개선 수치로 전용하지 않는다.
  invariant(누락·타 플랫폼 잔존)는 빌드 시 실패하도록 단언하며, closure 시험 8/8과
  `--verify` 1177 files가 통과했다.
- **왜 중요한지**: 내려받기·설치 시간과 기관 배포·백업·패치 비용에 직접 영향을 준다.
- 모델 자산 약 1.31 GB가 여전히 크기의 대부분이며, Windows v3 수용에서 설치 디렉터리
  크기는 2,135,273,579 B로 관측했다. 파일 잠금·네이티브 추론 비용은 별도로
  측정하지 않았다.
- **완화·다음 단계**: 모델 자산을 설치 후 내려받는 옵션은 점검 중 다운로드 금지 정책과
  충돌하므로 별도 계약으로 설계해야 한다(현재 그대로 바꾸지 않는다). Windows 설치 후
  크기·콜드 스타트 시간을 함께 재측정한다.
- 근거: `docs/ADOPTION_LEDGER.md` §「2026-10-23 최종 후보 (f481d73)」, 후보
  `manifest.json` `files`, `1c0e8a3` commit message, `docs/BUILD_MANUAL.md`
  §`npm run package:windows` 준비 3항.

## 5. 서명되지 않은 산출물

- **무엇인지**: 후보 `signing` 값은 `unsigned-internal-candidate`이고(`releaseStatus`는
  `candidate`), Authenticode 서명이 없다. SHA-256과
  artifact verify는 무결성만 확인하고 발행자 인증은 하지 않는다.
- **왜 중요한지**: 미서명 설치 파일은 SmartScreen·백신·조직 정책에서 차단되거나 경고를
  낼 수 있고, 배포 채널이 정해지지 않은 상태에서는 "기관 배포용"이라고 말할 수 없다.
  해시를 서명으로 오해하면 공급망 검증이 무력화된다.
- **완화·다음 단계**: 조직 인증서 발급과 승인 후 Tauri 서명 설정으로 Authenticode를
  연결한다. 그때까지는 manifest의 `source.commit`·`sourceSha256`·installer SHA-256을
  함께 대조하는 절차로 대체하고, SmartScreen/백신/보안 정책을 임의로 해제하지 않는다.
  updater 서명과 Authenticode를 혼동하지 않는다. 네트워크 자동 업데이트는 없다.
- 근거: `docs/BUILD_MANUAL.md` §산출물과 한계, `docs/OPERATIONS_GUIDE_KO.md`
  §배포 전 확인, `docs/VERIFICATION_SUMMARY.md` §5.

## 6. gnullvm 교차 빌드와 MSVC 경로

- **무엇인지**: 현재 Windows 후보는 Linux `x86_64-pc-windows-gnullvm` 교차 빌드이고
  Tauri가 "실험적"으로 표시한다. 수신팀의 주 배포 경로는 Windows MSVC 빌드다. MSVC
  경로의 CI(`windows-native`, `required`)는 계정 결제 차단으로 시작되지 않았다. 실제
  Windows에서의 `cargo test` 실행도 cross sysroot 부재로 NOT_RUN이다. gnullvm 후보의
  Windows 11 설치·대화형 UI는 v3로 관측했지만(§`VERIFICATION_SUMMARY.md` §7), 그것은
  MSVC 산출물의 검증이 아니다.
- **왜 중요한지**: 컴파일러·CRT·링커가 다르면 예외 처리, 로케일, DLL 로딩, WebView2
  interop 같은 경계에서 동작이 달라질 수 있다. gnullvm 후보의 verify 통과는 MSVC
  제품 경로의 검증을 대신하지 않는다.
- **완화·다음 단계**: MSVC 호스트에서 `npm run package:windows` → `verify:artifact` →
  Windows 설치·화면 수용을 실행하고, 그 결과로 배포 후보를 다시 식별한다. 그 전까지
  gnullvm 후보는 "Linux 교차 빌드 산출물"로만 표기한다.
- 근거: `docs/ADOPTION_LEDGER.md` §「Linux 교차 빌드 후보」, §「2026-10-23 통합 검증과
  최종 후보」, `docs/BUILD_MANUAL.md` §보존하는 별도 경로·§수신팀 주 경로,
  `docs/VERIFICATION_SUMMARY.md` §7.

## 7. 사람 사용성·보조기기(AT) 미검증

- **무엇인지**: 실제 사람 사용성 평가, 보조기기 판독, 최신 후보의 native 200% 확대는
  수행하지 않았다. D05/D06에서 native 포커스 복귀는 UIA가 `activeElement`를 노출하지
  않아 미확인이고, 브라우저 smoke에서만 통과했다. D03의 정확한 native CSS viewport도
  미측정이다.
- **왜 중요한지**: 이 제품의 목표 사용자는 웹 개발자가 아닌 담당자다. 화면이 설계
  기준(본문 17px, 버튼 44px, 키보드 도달, 200% 확대)을 만족해도 실제로 이해·완료하는지는
  별개이며, 공공기관 도입에는 접근성 근거가 필요하다.
- **완화·다음 단계**: 처음 쓰는 담당자가 기본 연결로 주소 입력 → 실패 범위 이해 →
  연속 근거 검토 → 보고서 저장을 도움 없이 수행하는지 관찰한다. 최종 native 후보에서
  1366×768·200% 확대·키보드 복귀·실제 Excel을 확인한다. AT는 별도 수용 항목으로
  남긴다.
- 근거: `docs/SCREEN_SPEC.md` §모드 전환·배치·접근성·§구현 순서와 수용 조건,
  `docs/DOGFOOD_LEDGER_20261014.md` §Task outcomes D03·D06 및 §Completion remains
  unproven, `docs/PLANNING_DOC.md` §8.4, `docs/ADOPTION_LEDGER.md` A11.

## 8. 그 밖의 잔여 위험(짧게)

| 항목 | 내용 | 완화·다음 단계 | 근거 |
| --- | --- | --- | --- |
| WARP 등록 자격의 평문 저장 | 앱 전용 WARP를 선택한 경우 `warp/config.json`에 평문 저장, ACL은 현재 사용자·SYSTEM 제한, 앱 자체 암호화 없음 | 단말 암호화·계정 권한은 조직 정책으로 결정. 공식 JSON·전달 폴더에는 자격 정보를 넣지 않음 | `docs/DATA_HANDLING_KO.md` |
| 설치본 565의 빠른 종료 결함 | 설치 565는 전면 Alt+F4 276.25ms에서 UIA 확인 메모를 잃었다. 수정 소스 후보는 218.54ms 종료에서 revision4를 보존했다 | 수정 후보를 Windows 설치본으로 수용해야 함. 강제 종료·OS 종료는 검사 범위 밖 | `docs/DOGFOOD_LEDGER_20261014.md` D05 |
| GIF·동영상 범위 | GIF 최대 120프레임 관찰·최대 4프레임 보존, APNG·애니메이션 WebP·동영상 미지원 | 선택하지 못한 구간은 "부분 분석"으로 표시. 후속 범위로 확장 검토 | `docs/PLANNING_DOC.md` §3.5 |
| 다중 사례 인프라 통합 | 여러 케이스 통합·능동 외부 탐색·추가 단서 지속 검토 미제공 | 단일 케이스 분석으로 한정해 안내 | `docs/PLANNING_DOC.md` §12, `docs/UX_FLOW.md` |
| 성능 근거의 범위 | Windows 수치는 2026-10-07 통합 후보 워커 기준이며 최신 이미지 분석 경로 미포함. 단일 실행 | 이미지 분석 포함 전체 점검 시간을 Windows에서 재측정 | `docs/PLANNING_DOC.md` §8.3·§12 |
| CI 부재 | 현재 HEAD의 CI 통과 기록 없음(계정 결제 차단) | 저장소 결제 정상화 후 `main` 대상 PR로 `verify`·`windows-native`·`required` 실행 | `docs/ADOPTION_LEDGER.md` §CI 시도와 차단 원인 |
| 스캐너 문서 전환 | 초기0361562d에서 NIA entry 누락 재현 |3598f48의 최대2회 문서 전환 처리·최종 HTTP 분류, loopback13시험 및 Windows5checked/0failed 관측. 새 후보 수용은 검증 요약 참조 | `resumed-validation/`, `resumed-windows/` |

## 9. 이 문서를 읽는 방법

위 항목 중 1·2·3·6은 제출 이후 운영 판단에 직접 영향을 준다. 제출 문서 어디에서도
이 항목들을 "완료"로 서술하지 않았는지 확인하려면
[`EVIDENCE_INDEX.md`](EVIDENCE_INDEX.md)의 NOT_RUN 행과
[`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md) §7을 함께 본다.
