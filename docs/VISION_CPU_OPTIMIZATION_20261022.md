# Gemma 비전 CPU 최적화 (2026-10-22)

비전 입력의 유효 패치를 보존하고 끝의 패딩만 제외하며 runtime 스레드 상한을8→6으로 조정했다.
CPU를 우선하는 선택이다. 같은 저해상도6배너의 전체 CPU 중앙값은41.99→35.00초,
벽시계는10.024→10.342초다.
처리 시간의 작은 증가를 숨기거나 속도와 CPU가 모두 개선됐다고 주장하지 않는다.
UI에 관측한 연결 주소 복사와 실패 안내를 추가했다. Windows는 사용자 지시대로 내일로 미뤘다.

## 실행 경로와 원인

`scanSite`의 공식 JSON commit 이후 `LocalOcrBackend`의 단일 killable worker가
OCR/대체 OCR→문자 의미→필요할 때 이미지 의미를 순서대로 수행한다.
이미지 의미는 `text-embedding.ts:createTextEmbedding().analyzeImage`에서 실제 픽셀과
seed1701 셔플 각각을 `preprocessPng`→vision encoder→FP32 image/text encoder→고정52참조와 비교한다.
공공안내·일반 광고·DOM 제외, deadline/이미지 수/GIF 프레임 예산, 판정 기준은 고정했다.

수정 전 source/runtime을 동결하고 먼저 baseline을 실행했다. 별도 ORT native profile에서
두 실제 배너×원본/셔플4 forwards에 wall4.350초/CPU34.768초를 관측했다.
연산 wall 합계 중 MatMulNBits2.133초, MultiHeadAttention1.164초가 주요 구간이었다.
operator별 실행/주 스레드 대기/작업 배분 정보는 native Chrome trace JSON에 보존했다.
하드웨어 cache/IPC 카운터는 perf_event_paranoid4로 미실행이며 cache miss나 특정 잠금이
원인이라고 단정하지 않는다. 한 번의 진단 profile은 아래 N5 성능 측정과 구분한다.

`preprocessPng`는 같은 리사이즈·bicubic AA·정규화·셔플·16px 패치를 만들고 최대2520개로 패딩한다.
작은 두 배너는 실제2430패치/270soft token이며, 끝90개는 픽셀0·포지션-1이다.
전처리는 그대로 두고 `prepared.softTokens*9`개의 유효 prefix만 ONNX 입력으로 넘긴다.
어떤 실제 픽셀·해상도·패치·셔플 대조·GIF 장면도 제외하지 않는다. 이 ONNX 그래프의 패치 축은
동적이며 출력은 같은270×512다. 두 배너×원본/셔플의 특징값은 별도 N5에서 바이트 동일했다.
offline 참조 생성은 기존2520패치 계약 그대로 두고, 기존 참조20+52의 바이트도 바꾸지 않았다.

runtime vision만 `min(6,availableParallelism())`, inter1이다. FP32 text2/1, neural OCR1/1과
offline reference 생성2/1은 유지한다. 모델/checkpoint/정밀도는 기존 FP32 text+8bit weight-only vision,
revision daa72c51243991dfcaf9f9137d2c573d8f7790c0 그대로다. 새 양자화/모델/학습/임계값 보정은 없다.

## 후보와 선택

같은 whole scan6배너, fresh Chromium/worker, warm 파일 캐시, 각N5 교대 비교다.
값은 중앙값(최소~최대, 표준편차)이다. raw 선택 실험은 selection/에 별도 보존했고
최종 채택 뒤 아래98개 formal scan을 새로 실행했다. 선택N5를 final N5인 것처럼 재사용하지 않았다.

| 후보 | 벽시계 초 | 전체 CPU 초 | 워커 VmHWM MiB |
|---|---:|---:|---:|
| 기존2520/cap8 | 10.197 (10.082~10.238, sd 0.064) | 42.430 (41.830~42.870, sd 0.426) | 1714.785 (1705.664~1734.863, sd 12.116) |
| 유효 패치/cap8 | 9.955 (9.885~10.051, sd 0.060) | 40.400 (40.230~40.620, sd 0.157) | 1706.742 (1690.734~1715.379, sd 9.031) |
| 유효 패치/cap6 (채택) | 10.480 (10.408~10.603, sd 0.078) | 35.480 (35.130~35.880, sd 0.321) | 1713.227 (1703.762~1723.824, sd 9.723) |
| 유효 패치/cap5 | 10.962 (10.785~11.078, sd 0.111) | 32.920 (32.730~33.360, sd 0.280) | 1707.480 (1701.121~1709.113, sd 3.161) |

cap8 compact는 빠르지만 CPU 감소가 작고, cap5는 CPU 절감이 크지만 대기 비용이 커서 cap6을 골랐다.
이 기기/자료/후보 안에서의 선택이며 모든 하드웨어의 최적값이라는 주장이 아니다.
정확도 우선 조건을 만족한 CPU/대기 시간 절충이며 지연 우선 구성은 기존 상한8이다.

Native N5에서 스핀OFF는 CPU34.785→31.273초지만 wall4.352→4.690초여서 채택하지 않았다.
100us 짧은 스핀+backoff8, 동적블록 조합, 자동 스레드와 force-stop/동적블록 단독도 별도 실행했다.
결과는 native-summary.json에 최소/중앙/최대/sd와 raw가 있다. 자동 스레드는 이 호스트에서
cap8보다 CPU가 늘었고, 다른 후보도 채택 구성보다 우월하다고 입증하지 못해 추가하지 않았다.
동적블록 단독+force-stop에는 출력 변화가 없었지만 유의한 이득도 입증하지 못했다.
이전의 Node extra 미지원 판단은 정정한다. 설치된 타입 주석의 extra 설명과 달리
ORT1.30.0 Node binding은 extra를 native config로 전달한다.
[해당 버전 구현](https://github.com/microsoft/onnxruntime/blob/v1.30.0/js/node/src/session_options_helper.cc),
[동일 버전 설정 키](https://github.com/microsoft/onnxruntime/blob/v1.30.0/include/onnxruntime/core/session/onnxruntime_session_options_config_keys.h),
[스레드 문서](https://onnxruntime.ai/docs/performance/tune-performance/threading.html)를 확인했고
로컬 binary의 validation도 확인했다. 최종 product에는 extra 튜닝을 추가하지 않았다.

## 정확도·원문·GIF

동일190입력/29묶음: 실제60/60·정상 오탐0/74, 파생17/18·정상 오탐0/38이 전후 같다.
2026-10-23 `ee123bb`+`depositCreativeTerms` 앵커 축소 후 같은 `inputs.json`(sha `eb1572b6…e8ad3`)로
새 bench dir에서 29묶음/190입력을 다시 측정했고 네 수치는 동일하다. 판정이 바뀐 7행
(`knownBlacktoon` original-1·2·3·4·5·8, `positive-bets8`)은 모두 v4 검토에서 v3 규칙으로
강화된 양성이고, 누락은 여전히 파생 BUTTER 1건뿐이다. 수집/OCR/프레임은 같다.
유일한 기존 누락은 극단 축소 파생 BUTTER이며 원본은 탐지한다. 성능 변경으로 해결했다고 주장하지 않는다.
모든 수집/OCR/대체 OCR/보조 모델은 완료됐고, 원문/대체 원문/신뢰도/선택 엔진/판정 경로,
연결 주소/출처, GIF 프레임/시각/순서와 기존 부분 분석 표시는 같다.
점수 성분의 최대 절대 차이는 {'textEmbedding': 0.0, 'visualEmbedding': 0.0}, 사전 허용1e-5 이내다.
공식 JSON은 모든 scan에서 최초 commit 바이트를 유지했다.
별도 profile의 valid patch 픽셀/위치 SHA·순서와 recognizer 입력73개의 SHA/모양을 전후 대조했다.

190개는 기존 개발/회귀 자료로 일부 참조와 겹친다. 새 독립 표본의 현장 정확도는 아니다.
실제 정상 GIF1개, 실제 광고에서 파생한 GIF3개+장면 대조4개를 포함하며 새 불법 원본 GIF를
확보한 것은 아니다. 법적 위반 확정이 아닌 검토 후보를 포함한다.

## 최종 전체 처리·CPU·메모리

Ryzen7 9700X8코어/16논리CPU, 약32GB RAM, Linux, Node26.8.1, ORT Node1.30.0 CPU.
대표5묶음 전후N5+나머지24묶음 전후N1=98 formal receipt.
초기 수정 전 baseline을 확보한 뒤 최종 frozen before/after를 새 교차 순서로 모두 실행했다.
버린 warmup과 diagnostic profile, 후보실험은 formal 분모에 포함하지 않았다.
전체 시간은 scanSite 호출부터 worker 정리 완료까지, CPU는 GNUtime user+system으로
scan Node와 재수거한 Chromium/OCR/native 모든 하위 process/thread를 합한다.
CPU에는 startup/fixture 준비/타이머 이후 receipt 작업도 포함하며 외부 sampler 부모는 제외한다.
25ms procfs worker VmHWM은 종료 직전 peak를 놓칠 수 있다. RSS 트리 합은 공유 페이지 중복이며
물리 점유/PSS가 아니다. GNUmaxRSS도 최대 개별 process 값으로 별도 남겼다.

| 묶음 | 지표 | 수정 전 중앙값(최소~최대, sd) | 수정 후 중앙값(최소~최대, sd) | 쌍별 차이 중앙값(최소~최대, sd) |
|---|---|---:|---:|---:|
| 저해상도 실제 배너6개 | 벽시계 초 | 10.024 (9.955~10.084, sd 0.054) | 10.342 (10.321~10.430, sd 0.043) | 0.339 (0.237~0.387, sd 0.056) |
| 저해상도 실제 배너6개 | CPU 초 | 41.990 (41.230~42.080, sd 0.371) | 35.000 (34.860~35.190, sd 0.140) | -6.840 (-7.130~-6.240, sd 0.408) |
| 저해상도 실제 배너6개 | 워커 VmHWM MiB | 1718.008 (1712.992~1738.215, sd 10.178) | 1704.230 (1698.234~1720.348, sd 8.849) | -17.867 (-24.449~-3.668, sd 8.479) |
| 기존 실제 배너6개 | 벽시계 초 | 6.814 (6.780~6.860, sd 0.031) | 6.792 (6.776~6.864, sd 0.036) | -0.018 (-0.038~0.012, sd 0.020) |
| 기존 실제 배너6개 | CPU 초 | 7.970 (7.930~7.990, sd 0.023) | 7.960 (7.930~8.040, sd 0.042) | -0.020 (-0.040~0.070, sd 0.047) |
| 기존 실제 배너6개 | 워커 VmHWM MiB | 1110.301 (1107.414~1111.777, sd 1.827) | 1107.000 (1100.375~1110.246, sd 3.626) | -4.305 (-11.113~2.832, sd 5.039) |
| 파생 GIF3개 | 벽시계 초 | 1.509 (1.486~1.544, sd 0.021) | 1.500 (1.481~1.552, sd 0.028) | -0.009 (-0.062~0.066, sd 0.047) |
| 파생 GIF3개 | CPU 초 | 1.940 (1.930~1.960, sd 0.011) | 1.960 (1.930~2.010, sd 0.029) | 0.030 (-0.030~0.070, sd 0.036) |
| 파생 GIF3개 | 워커 VmHWM MiB | 491.617 (488.645~523.516, sd 14.698) | 504.898 (463.809~532.684, sd 25.686) | 3.727 (-35.219~41.066, sd 30.567) |
| 기존 실제 배너5개 | 벽시계 초 | 4.696 (4.680~4.752, sd 0.028) | 4.717 (4.676~4.777, sd 0.038) | -0.003 (-0.035~0.081, sd 0.046) |
| 기존 실제 배너5개 | CPU 초 | 5.730 (5.700~5.880, sd 0.087) | 5.870 (5.710~5.910, sd 0.078) | 0.010 (-0.030~0.180, sd 0.098) |
| 기존 실제 배너5개 | 워커 VmHWM MiB | 1397.480 (1392.117~1409.840, sd 6.570) | 1400.180 (1396.066~1414.051, sd 7.182) | 2.699 (-12.582~17.289, sd 11.670) |
| 실제 정상 광고6개 | 벽시계 초 | 2.366 (2.343~2.376, sd 0.013) | 2.368 (2.340~2.618, sd 0.114) | 0.025 (-0.036~0.248, sd 0.111) |
| 실제 정상 광고6개 | CPU 초 | 3.270 (3.230~3.350, sd 0.049) | 3.260 (3.210~3.430, sd 0.089) | 0.030 (-0.140~0.200, sd 0.125) |
| 실제 정상 광고6개 | 워커 VmHWM MiB | 1146.688 (1134.551~1158.070, sd 8.648) | 1133.863 (1094.152~1152.875, sd 21.754) | -12.824 (-40.398~9.812, sd 18.807) |

음수는 절감이다. 비전이 없는 경로의 미세 변동은 개선으로 주장하지 않는다.
쌍별 차이가0을 넘나들거나 분산에 묻히는 수치는 확인된 개선으로 해석하지 않는다.
formal 비교 중 소유 모델/빌드/테스트/UI를 동시에 실행하지 않았다. desktop/MCP 서비스 부하,
전력/온도/affinity는 고정하지 못했다. N0 native trim warmup 일부는 UI baseline과 겹쳐 버렸다.
N1 이후 native 비교와 formal에는 이 중첩이 없다. 다른 CPU/Windows/cold 설치는 미측정이다.

## UI·검증·재현

이미지 근거를 펼쳤을 때만 관측 연결 주소의 복사 버튼을 제공한다. 원문 주소는 평문으로
선택 가능하고, 성공은 status로 알리며 거부/미지원은 직접 선택 안내로 복구한다.
주소가 없는 기록에서 주소를 추정하거나 원본 이미지 URL을 대신 복사하지 않는다.
기존 원문/대체 원문/GIF 설명·간단/고급 모드·지연 조회·목록 밀도를 유지했다.
브라우저 replay는 실제6배너 receipt/PNG, 320/768/1024/1440폭, 키보드 열기/닫기와
대체 원문을 확인했고, 복사 API만 테스트 문맥에서 대체해 사용자 clipboard를 덮어쓰지 않았다.
외부 요청/WARP/page error0, 공식 JSON 원본 유지, 열기 전 분석 조회0을 확인했다.
617건 모드/필터/메모/관계 복귀/JSON 바이트·엑셀618행 보존도 확인했다.
Windows WebView2/native clipboard/사람/AT 수용은 미실행이다.

초기 전체 테스트에서는 주소 텍스트가 dd의 직접 자식이라고 가정한 UI selector1건이 실패했다.
주소 복사 컨트롤 추가 후에도 같은 dt/dd 레이블을 검사하도록 closest(dd)로 수정했다.
초기 lint의 브라우저 문맥 navigator 전역 표기도 globalThis.navigator로 고쳤다.
원본 실패 로그를 보존했으며 최종 검증 결과는 아래 로그를 따른다.

검증 명령/로그: build-scanner-final.log, build-web.log, typecheck.log, lint.log, test-full.log,
ui-after.log, ui-modes.log, summary.json, native-summary.json, candidate-summary.json,
receipt-audit.json, delivery-audit.json을 확인한다.

```sh
npm run build:scanner
EMBEDDING_BENCH_DIR=artifacts/vision-cpu-20261022 EMBEDDING_CPU_TIME=1 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs --measure before latestPositive 0
EMBEDDING_BENCH_DIR=artifacts/vision-cpu-20261022 EMBEDDING_CPU_TIME=1 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs --measure after latestPositive 0
python3 artifacts/vision-cpu-20261022/resume.py
python3 artifacts/vision-cpu-20261022/summarize.py
```

freeze는 기존 identity를 덮어쓰지 않는다. 재현 시 새 evidence 디렉터리에 입력/protocol과
수정 전 source를 보존하고 freeze before→첫 baseline→변경/build→freeze after 순서로 실행한다.
프로파일은 `--freeze before --profile`/`--freeze after --profile` 후 `--profile before/after`로 별도 실행한다.
`KRDS_TEST_UNSANDBOXED=1`은 소유 loopback fixture만 사용하며 외부 사이트 sandbox 우회 허가가 아니다.
source는 canonical repo, raw는 승인 NAS <external-evidence>/illegal-ad/validation/vision-cpu-20261022/에 있다.
commit/push/PR/배포/설치/대회 제출은 하지 않았다.

최종 검증: scanner/web build, typecheck, lint, git diff --check 통과.
전체95파일은703 passed/1기존 skipped, 관련 UI33개도 통과했다.
실제 pinned 모델로 이미지/문자 분리, 정상 대조, native deadline 후 복구·취소 경계를 확인했다.
최종 canonical worker SHA는5d4faf1bafc210186b026fe555a59e8c5ded10daf64789683bbf9c707d5ddff6이며
선택 t6-runtime과 최종 after-runtime의 실제 바이트가 같다.

## 후속 검토: 2026-10-22 attention 패딩·prepack·스레드 고정 (채택 안 함)

후속 4-way 비교는 `artifacts/vision-fusion-20261022/follow-probe.mjs`로 실행했다. 각 실행은 새 프로세스 1개, 입력 4종(positive-smile/positive-dubai × 원본/셔플), 유효 패치 prefix만 ONNX 입력이다. 세션 옵션은 공통 `{executionProviders:['cpu'],intraOpNumThreads:6,interOpNumThreads:1}`이다.

후보 정의:
- `before`: 출하 그래프 `packages/evidence/dist/text-embedding-data/onnx/vision_encoder_quantized.onnx` + 출하 세션 프로필(추가 extra 없음).
- `attention64`: `<external-evidence>/illegal-ad/validation/vision-fusion-20261022/model-candidates/attention64/vision.onnx`. `attention-transform.json` 기준 MultiHeadAttention 16개 층에서 68→64 패딩을 제거한 변환 그래프(노드 709→622). 전제: 배치1, 유효 위치 쌍만, -1 패딩 패치 없음; 가중치/scale 1/heads 12와 실제·셔플 forward 및 모든 이미지 패치 유지.
- `unpacked`: 출하 그래프 + `{extra:{session:{disable_prepacking:'1'}}}`.
- `pinned`: 출하 그래프 + `{extra:{session:{intra_op_thread_affinities:'1;2;3;4;5'}}}`.

측정값(네이티브 encoder 단계, 6회):

| 후보 | n | 벽시계 ms 중앙값(최소~최대) | CPU ms 중앙값 | 워커 maxRss KiB 중앙값 | positive-dubai 원본 특징 SHA-256 | before와 동일 여부 |
|---|---:|---:|---:|---:|---|---|
| before | 6 | 4470.061 (4431.354~4525.058) | 26809.132 | 700180 | 68c19f7f5994a8e1bde838ddf703ac810f3f3563440bba92a5ee1fa2184d6744 | 기준 |
| attention64 | 6 | 4146.114 (4132.369~4168.743) | 24859.207 | 648276 | 1490c75647419b5a59a6b49dd461cdd880cdb5b9e3c6f21f36f81b3e86d4293f | 아니오 |
| pinned | 6 | 5861.797 (4460.426~6996.045) | 35156.984 | 700656 | 68c19f7f5994a8e1bde838ddf703ac810f3f3563440bba92a5ee1fa2184d6744 | 예 |
| unpacked | 6 | 4467.639 (4446.619~4661.411) | 26791.786 | 699224 | d79a08a189c57622daf283e010c9e663a156cc1e6b0aa5c5f858aba980ca331c | 아니오 |

attention64 대 before 중앙값 차이: 벽시계 -7.25%, CPU -7.27%, 워커 maxRss -7.41%.

결정: 채택하지 않는다. 이유:
- attention64의 출력 바이트가 출하 그래프와 다르다. 동결된 image/text 참조 특징과 바이트 비교 계약을 재생성·재검증해야 한다.
- 절감은 gated image-embedding 단계에만 적용되며 이미지 1장당 약 1.1초, 이미지 예산으로 제한된다. 전체 scan 효과는 1초 미만이다.
- unpacked는 noise 범위다(벽시계 -0.05%, CPU -0.06%, RSS -0.14%).
- pinned은 더 나쁘다(벽시계 +31.13%, CPU +31.14%).
따라서 출하 그래프와 세션 프로필을 유지하고 제품 코드/모델 변경은 없다.

측정 한계: 단일 호스트, 실행당 프로세스 1개, 변형한 것은 그래프/세션 옵션뿐이며 하드웨어/전력/온도/affinity는 고정하지 않았다. 이 수치는 네이티브 encoder 단계 수치이며 전체 scan 수치가 아니다. per-forward 절대 시간은 attention64 약 1.0초, before 약 1.1초다.

증거: `artifacts/vision-fusion-20261022/` (follow-pairs.log 24 JSON 줄, native-probe.mjs, follow-probe.mjs, attention-transform.json, attention-candidate.py, fuse-candidate.py). 후보 모델은 외부 `<external-evidence>/illegal-ad/validation/vision-fusion-20261022/model-candidates/`에 있으며 채택하지 않는다.
