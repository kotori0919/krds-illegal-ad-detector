# 한계와 위험

이 문서는 해결됐다고 주장하지 않는 항목을 정리한다. 각 항목은 **무엇인지 / 왜
중요한지 / 완화·다음 단계** 순서다. 수치는 모두 출처 절을 함께 적었다. 검증 수치의
범위는 [`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md), 절차는
[`BUILD_AND_RUN.md`](BUILD_AND_RUN.md), 제품 개요는
[`APPLICATION_SUMMARY.md`](APPLICATION_SUMMARY.md)를 따른다.

## 1. D08 — 재시작 후 두 대상 통합 보고서

- **무엇인지**: 두 공개 대상의 판단·메모를 포함한 **통합** 엑셀 보고서를 앱 재시작
  후 생성하는 경로가 아직 실행되지 않았다. 판정이 있는 케이스는 단일 대상 배치였다.
  일괄 작업 묶음(그룹)의 재시작 복원은 미구현이다.
- **왜 중요한지**: 실제 운영은 여러 사이트를 한 번에 점검하고 하나의 보고서로
  결재·시정 요청하는 흐름을 갖는다. 두 대상 통합 보고서가 재시작 후에도 판단·메모를
  담는지 확인되지 않으면 "일괄 운영이 검증됐다"고 말할 수 없다. 개별 케이스와 검토
  기록은 재시작 후에도 남는다.
- **완화·다음 단계**: 지금은 대상별 공식 결과를 각각 보관하고, 사이트별 보고서를
  개별 생성해 사람이 취합한다. 보고서에는 점검 범위 제한이 함께 기록된다. 다음
  단계는 대상 2건·판단·메모 포함 → 정상 종료 → 새 프로세스 → 통합 XLSX 생성 →
  실제 Excel 열람의 순서로 수용하는 것이다.
- 근거: `docs/DOGFOOD_LEDGER_20261014.md` §Task outcomes D08 및 §Completion remains
  unproven, `docs/UX_FLOW.md` §고급 모드, `docs/PLANNING_DOC.md` §12.

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
  OCR·임베딩 단계별로 분류한다. 회귀 자료는 실제 출처 불법 배너 60/60, 실제 정상 광고
  오탐 0/74, 파생 양성 17/18, 파생 정상 오탐 0/38로 기록되어 있으나 이는 개발·회귀
  자료이며 법적 위반 확정률이 아니다. EasyOCR·Korean TrOCR 비교에서 TrOCR은 알려진
  정상 입력 3/10 오탐으로 기각됐다.
- 근거: `docs/PLANNING_DOC.md` §12, `docs/DOGFOOD_LEDGER_20261014.md`,
  `docs/EMBEDDING_QUANTIZATION_20261022.md`, `docs/VISION_CPU_OPTIMIZATION_20261022.md`,
  `docs/OCR_ENGINE_COMPARISON_20261021.md`, `docs/ADR/0017-...md` §Alternatives and limits.

## 3. Cold-start 임베딩 예산 동작

- **무엇인지**: Linux 2 CPU 고정·page cache evict 조건에서 첫 text 임베딩은 3.65초
  (상한·production timeout 8초), 첫 image 임베딩은 11.4초(상한·timeout 16초)였다.
  인위적 3배 oversubscription에서 text 5.5~6.0초, image 18.5~46.7초를 관측했다(MEASURED,
  이번에 수정하지 않음). 느린 하드웨어에서 첫 text/image 임베딩 근거가 `budget`으로
  탈락할 수 있고, child worker가 종료된다.
- **왜 중요한지**: 탈락은 fail-closed여서 **오탐은 만들지 않지만**, 이미지만 있는
  광고는 놓칠 수 있다. 즉 같은 사이트라도 첫 실행과 이후 실행의 결과가 달라질 수 있고,
  평가 환경(4~6코어·8GB·무GPU)의 콜드 스타트에서 재현율이 낮아질 수 있다.
- **완화·다음 단계**: production 코드는 변경하지 않았다. 권장 후속 수정은 post-commit
  단계 전 embedding warming과 초기화 시간을 `elapsedMs` 측정 구간에서 제외하는 것이다.
  그때까지는 콜드 스타트 결과에서 `budget` 탈락 사유를 점검 범위·추가 분석 화면에서
  확인하고, 필요하면 재점검한다.
- 근거: `docs/ADOPTION_LEDGER.md` §「실측 잔여 위험 (MEASURED; 이번에 수정하지 않음)」.

## 4. 설치 크기 759.46 MiB와 전 플랫폼 onnxruntime 포함

- **무엇인지**: 현재 후보 installer는 `796,348,611` B(759.46 MiB)다. 모델 약 1.31 GB와
  스테이징 `node_modules` 약 376 MB를 포함한다. `onnxruntime-node`가 모든 플랫폼
  바이너리(약 288 MB)를 실어 나르지만 런타임은 `win32-x64`만 사용하며 바이너리 pruning은
  구현되어 있지 않다.
- **왜 중요한지**: 내려받기·설치 시간이 길고, 기관 배포·백업·패치 비용이 커진다. 같은
  이유로 다운로드 실패·디스크 부족 위험이 커진다. 또한 Windows에서의 실제 설치 크기·
  파일 잠금·네이티브 추론 비용은 측정하지 않았다.
- **완화·다음 단계**: 빌드 단계에서 `onnxruntime-node`의 비대상 플랫폼 바이너리를
  제거하고 런타임 load를 검증한 뒤, 설치 크기와 콜드 스타트 시간을 함께 재측정한다.
  모델 자산은 필요 시 설치 후 내려받는 옵션을 별도 계약으로 설계해야 한다(현재는 점검
  중 다운로드 금지 정책이므로 그대로 바꾸지 않는다).
- 근거: `docs/ADOPTION_LEDGER.md` §재빌드(installer hash·크기), §실측 잔여 위험
  (모델·`node_modules`·`onnxruntime-node` 구성), `docs/BUILD_MANUAL.md`
  §`npm run package:windows` 준비 3항.

같은 `ADOPTION_LEDGER.md` §실측 잔여 위험 문단의 "759.44 MiB" 표기는 **선행
후보**(`3fb23…`, `796,331,514` B) 수치다. 현재 후보는 759.46 MiB이며, 모델·스테이징
크기 서술만 현재 후보에도 유효하다.

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
  Windows에서의 시험 실행도 cross sysroot 부재로 NOT_RUN이다.
- **왜 중요한지**: 컴파일러·CRT·링커가 다르면 예외 처리, 로케일, DLL 로딩, WebView2
  interop 같은 경계에서 동작이 달라질 수 있다. gnullvm 후보의 verify 통과는 MSVC
  제품 경로의 검증을 대신하지 않는다.
- **완화·다음 단계**: MSVC 호스트에서 `npm run package:windows` → `verify:artifact` →
  Windows 설치·화면 수용을 실행하고, 그 결과로 배포 후보를 다시 식별한다. 그 전까지
  gnullvm 후보는 "Linux 교차 빌드 산출물"로만 표기한다.
- 근거: `docs/ADOPTION_LEDGER.md` §「Linux 교차 빌드 후보」, §「재빌드 (85a286f)」의
  NOT_RUN, `docs/BUILD_MANUAL.md` §보존하는 별도 경로·§수신팀 주 경로,
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

## 9. 이 문서를 읽는 방법

위 항목 중 1·2·3·6은 제출 이후 운영 판단에 직접 영향을 준다. 제출 문서 어디에서도
이 항목들을 "완료"로 서술하지 않았는지 확인하려면
[`EVIDENCE_INDEX.md`](EVIDENCE_INDEX.md)의 NOT_RUN 행과
[`VERIFICATION_SUMMARY.md`](VERIFICATION_SUMMARY.md) §7을 함께 본다.
