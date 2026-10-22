# 이미지 분석 지연 최적화 (2026-10-22)

현재 채택한 **문자 FP32 + 8비트 가중치 이미지 인코더**에서 실행 병렬도를 개선했다.
이미지 인코더만 `Math.min(8, availableParallelism())` intra-op / 1 inter-op로 실행한다.
문자 인코더와 build-only 참조 생성은 기존 2 / 1이다. 모델, 20개 문자·52개 이미지 참조,
모든 임계값·공공안내/일반 광고/동일 DOM 제외 규칙·OCR·예산·GIF 프레임·shuffle seed1701은 유지했다.
새 학습·양자화·보정은 없고, Windows는 사용자 지시에 따라 미실행이다.

## 원인과 선택

수정 전 저해상도6배너의 별도 진단 profile은 전체16.058초 중 이미지 인코더4회에9.754초,
그 구간 worker CPU19.515초를 기록했다. 사용한2개 스레드를 채우는 CPU 실행이 지연의 주된 원인이었다.
전처리는0.090초여서 먼저 건드릴 병목이 아니었다. 같은2520×768 FP32 patch와 실제/섞기 대조를
모두 유지하고 이미지 인코더의 병렬도만 바꿨다. 원본2개 각각의 actual/shuffle4회가 남아 있다.

기존 worker와 스캐너를 수정 전에 동결하고 실제 baseline을 먼저 실행했다.
후보2는 canonical baseline bundle SHA와 바이트 단위로 같다. 후보4/6/8/12/16은 해당
vision 세션의 intra-op 수만 바꿨다. 같은6배너를 두 개의 교차 비교시리즈로 각각5회 측정했고,
각 구성의 warmup은 버렸다. 서로 다른 시리즈를 같은 시각의 paired 결과로 합치지 않는다.

| 비교시리즈 | 이미지 스레드 | 전체 초 중앙값 (최소–최대) |
|---|---:|---:|
| 2/4/6/8 | 2 | 16.002 (15.899–16.184) |
| 2/4/6/8 | 4 | 12.038 (11.950–12.650) |
| 2/4/6/8 | 6 | 10.937 (10.785–11.243) |
| 2/4/6/8 | 8 | 10.419 (10.287–10.923) |
| 8/12/16 | 8 | 10.504 (10.469–10.555) |
| 8/12/16 | 12 | 11.233 (11.169–11.326) |
| 8/12/16 | 16 | 11.343 (11.283–11.557) |

첫 시리즈의2/4/6/8은 유효 반복1/2/3/5/6을 썼다. round4는 추가 후보의 짧은 bundle 준비가
t2 실행과 겹쳐 전체 round를 제외하고 새 round6으로 교체했다. 제외 raw도 남겼다.
8/12/16은 별도1~5회다. 각 시리즈는 순서를 회전하고 반대로 번갈아 실행했다.
8스레드는 더 많은12/16스레드보다 모든 paired 실행에서 빨랐다. 이 기기와 조사한6가지 중
가장 빠른 설정이며 모든 하드웨어·가능한 알고리즘의 전역 최적이라는 뜻은 아니다.
후보 첫 시리즈 점수 차이는0, 확장 시리즈 최대 차이는5.53e-8이었다(사전 허용치1e-5).

## 제품 경로의 품질 비교

선택한 구성을 canonical source→build:scanner→동결한 after runtime에 통합한 뒤,
수정 전 실행본과 전체190입력을 다시 비교했다. 각 scan은 실제 수집/문자 인식/의미 비교를 수행한다.
비성능25묶음은 전후 각1회, 대표4묶음은 전후 각5회로 총90 formal receipt다.
선택 후보 탐색·warmup·profile은 이 분모에 섞지 않았다.

| 자료 | 기존 2스레드 | 변경 후 |
|---|---:|---:|
| 실제 출처 불법 배너 | 60/60 | 60/60 |
| 실제 정상 광고 오탐 | 0/74 | 0/74 |
| 별도 파생 양성 | 17/18 | 17/18 |
| 별도 파생 정상 오탐 | 0/38 | 0/38 |

190입력 모두 수집됐고 OCR/대체 OCR 원문·신뢰도·엔진, 선택된 프레임/시각·근거·판정 경로와 결과가 같다.
모든 호출된 OCR/의미 비교는 available이었다. 비교한 점수 성분 최대 절대 차이는
{'textEmbedding': 0.0, 'visualEmbedding': 0.0}이며 사전에 고정한1e-5 이내다. 실제/섞기 대조, source/destination,
유사도 모델/정책/seed도 비교했다. 공식 JSON은 각 scan에서 먼저 commit한 바이트를 끝까지 보존했다.
loopback의 임시 port와 별도 증명된 PNG 컨테이너 동등성만 비교에서 정규화한다. raw 기록은 변경하지 않는다.
현재 PNG 컨테이너 차이 쌍은 []이다. 픽셀 동등 비교에는 각 획득 asset의
원래 SHA와 디코딩 RGBA/너비/높이를 receipt에 남겼다. PNG identity 계산은 타이머 뒤에 수행하며,
메모리 샘플링은 receipt 기록을 포함한 child 수명 전체에 적용된다.

극단 축소한 BUTTER 파생1건의 기존 누락은 그대로다. 원본은 탐지한다.
파생 GIF3개 및 추가 프레임 대조4개는 유지했고, 기존 ANIMATION_PARTIAL 제한 표시도 유지한다.
이들은 원본 배너 픽셀로 만든 프레임 대조이며 새 불법광고 원본 GIF를 수집했다는 뜻이 아니다.
전체 자료는 이전에 사용한 개발/회귀 자료이고 일부 참조 사례와 겹친다.
역사적인 fresh/heldout/unseen 이름도 이번 비교의 새 독립 출처를 뜻하지 않는다.
탐지에는 사람 검토 후보가 포함된다. 모집단 정확도·법적 위반 확정·현재 차단 사이트의 현장 성능은 미검증이다.

## 전체 시간과 메모리

Ryzen7 9700X8코어/16논리CPU, 약32GB RAM, Linux, Node26.8.1/ONNX Runtime Node1.30.0/CPU에서
같은 NAS·입력·모델·warm 파일 캐시로 실행했다. 매번 새 브라우저와 새 OCR child를 사용한다.
전후 순서를 번갈아 대표4묶음 각5회 측정했고 warmup을 버렸다. formal 실행 중 다른 소유
테스트/빌드/모델/브라우저 replay를 실행하지 않았다. 데스크톱 서비스·전력·온도·affinity는 고정하지 않았다.
시간은 전체 scan/추가 이미지 분석/워커 정리를 포함하며 profile instrumentation은 넣지 않았다.

| 묶음 | 기존 초 중앙값 (최소–최대) | 변경 후 | 쌍별 차이 초 중앙값 (최소–최대) |
|---|---:|---:|---:|
| 저해상도 배너 6개 | 15.935 (15.889–16.045) | 10.388 (10.228–10.417) | -5.583 (-5.670–-5.496) |
| 파생 GIF 3개 | 1.566 (1.551–1.593) | 1.567 (1.566–1.590) | 0.001 (-0.027–0.038) |
| 기존 추가 배너 5개 | 4.847 (4.814–4.860) | 4.828 (4.797–4.837) | -0.017 (-0.039–-0.008) |
| 실제 정상 광고 6개 | 2.356 (2.349–2.375) | 2.363 (2.332–2.377) | 0.000 (-0.035–0.028) |

쌍별 차이가 음수이면 단축이다. 양·음이 섞이거나 분산에 묻힌 차이는 개선으로 해석하지 않는다.
이미지 인코더를 호출하지 않는 GIF/정상 광고 등은 이 변경의 직접 수혜 대상이 아니다.
190개 전부를5회 반복한 평균 성능이나 전체 운영 처리량으로 외삽하지 않는다.

Linux procfs25ms 외부 샘플링이다. VmHWM은 종료 전에 관측한 OCR child 최대값이고 마지막 순간
peak를 놓칠 수 있다. 트리 RSS 합은 공유 페이지 중복이 있어 PSS/물리 점유량이 아니다.

| 묶음 | 메모리 지표 | 기존 MiB 중앙값 (최소–최대) | 변경 후 | 쌍별 차이 MiB 중앙값 (최소–최대) |
|---|---|---:|---:|---:|
| 저해상도 배너 6개 | OCR child VmHWM | 1778.363 (1771.074–1798.324) | 1776.809 (1773.727–1777.883) | -2.363 (-20.973–5.734) |
| 저해상도 배너 6개 | 트리 RSS 합 | 2027.969 (1969.641–2033.996) | 1996.633 (1979.984–2000.508) | -27.461 (-48.781–29.836) |
| 파생 GIF 3개 | OCR child VmHWM | 511.340 (480.707–522.363) | 500.441 (477.719–515.629) | -21.922 (-41.594–34.922) |
| 파생 GIF 3개 | 트리 RSS 합 | 703.793 (668.824–734.586) | 686.734 (673.484–723.973) | -17.059 (-37.773–20.180) |
| 기존 추가 배너 5개 | OCR child VmHWM | 1395.484 (1335.973–1405.328) | 1396.410 (1327.312–1400.129) | 0.266 (-67.969–60.438) |
| 기존 추가 배너 5개 | 트리 RSS 합 | 1653.566 (1570.934–1668.867) | 1635.535 (1589.742–1679.918) | 4.000 (-79.125–93.254) |
| 실제 정상 광고 6개 | OCR child VmHWM | 1152.340 (1131.586–1155.023) | 1113.043 (1090.051–1153.344) | -33.098 (-62.711–-1.680) |
| 실제 정상 광고 6개 | 트리 RSS 합 | 1406.168 (1402.926–1427.449) | 1374.699 (1365.262–1403.414) | -37.539 (-62.188–-2.754) |

모델6파일1,312,154,937바이트와 참조 파일은 그대로다. 모델 크기나 메모리를 줄이는 변경으로 설명하지 않는다.

## 구간별 확인과 비용

아래는 타이밍 비교와 분리한 진단 N1이다. 중첩된 span은 더하지 않는다.

| 구간 | 호출 수 전/후 | 기존 초 합 | 변경 후 초 합 |
|---|---:|---:|---:|
| PP-OCR 전체(하위 연산 포함) | 10 / 10 | 3.596 | 3.607 |
| 문자 영역 검출(위 전체에 포함) | 10 / 10 | 2.093 | 2.083 |
| 문자 인식(위 전체에 포함) | 73 / 73 | 0.635 | 0.629 |
| 이미지 전처리 | 4 / 4 | 0.090 | 0.087 |
| 이미지 인코더 | 4 / 4 | 9.754 | 4.168 |
| 이미지 특징→문자 인코더 | 4 / 4 | 0.715 | 0.723 |
| 일반 문자 인코더 | 8 / 8 | 0.218 | 0.238 |
| 토크나이저 준비 | 1 / 1 | 0.461 | 0.489 |

이미지 인코더 worker CPU는19.515→33.303초, 해당 구간 지연은9.754→4.168초였다.
짧은 응답 시간을 위해 더 많은 CPU 병렬 연산을 사용하는 교환이다. 에너지·전력은 측정하지 않았다.
profile의 CPU는 span 동안 전체 worker process의 CPU 사용량이며 다른 native thread의 활동도 포함한다.
OCR·다른 모델의 pool은 늘리지 않았고 한 scan당 하나의 serial/killable OCR child를 유지한다.
여러 대상 batch도 기존 순차 실행을 유지한다. 낮은 CPU 수에서는 availableParallelism보다 많은
vision thread를 요청하지 않는다. 저코어 PC의 실제 속도와 Windows의 최적 스레드 수는 미측정이다.

## UI/UX

간단 모드의 동일 이미지 검토 안내를 목록 위에 한 번 표시하고, 상단과 같은 진입URL만 카드에서 생략했다.
다른 하위 페이지 URL은 남는다. 이미지 근거에서는 이미 저장된 destinationUrl을
이미지 주소/관측 페이지와 구분해 평문으로 보여 준다. 주소가 없는 옛 기록은 없음을 표시한다.
주소 자동 접속, 새로운 인프라 탐색, 원문 축약/수정은 없다. 고급 모드 정보와 일반 점검/WARP 선택도 유지했다.

같은6배너 receipt/1366px 화면에서 첫3카드 하단1575.64→1273.14px,
전체 높이2988→2339px였다. 320/768/1024/1440px 가로넘침0, 320px 근거 값 너비256px,
열기 전 근거 조회0, 키보드 개별 열기/닫기·긴 원문 전체 보기·원본PNG/공식JSON 보존을 확인했다.
관측 연결 주소는 fixture의 observed-offer.example로, 실제 광고주에 접근한 것이 아니다.
617건 결과에서 모드 기억·필터·검토 메모·관계 화면 복귀·원본JSON/엑셀618행이 보존됐다.
첫3행759.875px/360px 넘침0/WARP호출0/pageerror0을 확인했다.
이 UI 증거는 실제 웹 build + Tauri adapter replay이며 Windows/native/사람/보조기기 수용 시험은 아니다.

## 재현과 감사

`packages/evidence/src/text-embedding.ts`의 lazy vision 세션만 병렬도를 바꾼다.
같은 파일의 문자 모델과 참조 생성, `image-preprocess.ts`, 정책 JSON/참조/manifest는 유지한다.
`ocr.ts`의 serial 큐·deadline·abort→SIGKILL 경로도 유지한다. 이미지 통합 시험은 warmed native pool의
deadline 이후 정상 광고 판정 복구, warmed 이미지 요청 중 취소/닫힘도 확인한다.
UI 변경은 `apps/web/src/screens/ScanResult.tsx`이며 lazy 읽기·주소 구분·하위 페이지 보존을 시험했다.

```sh
node artifacts/image-latency-20261022/prepare-candidates.mjs
python3 artifacts/image-latency-20261022/run-candidates.py
# 이 실행에서는 준비 중 부하가 겹친 round4를 제외하고 round6으로 대체했다.
python3 artifacts/image-latency-20261022/run-candidates.py --repeat6
node artifacts/image-latency-20261022/prepare-candidates.mjs --extension
python3 artifacts/image-latency-20261022/run-extension.py
python3 artifacts/image-latency-20261022/compare.py
python3 artifacts/image-latency-20261022/compare.py --extension
npm run build:scanner
EMBEDDING_BENCH_DIR=artifacts/image-latency-20261022 node benchmarks/embedding-precompute.mjs --freeze after
EMBEDDING_BENCH_DIR=artifacts/image-latency-20261022 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs --profile after
EMBEDDING_BENCH_DIR=artifacts/image-latency-20261022 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs
# 중단 후에는 완료된 memory receipt를 보존하고 원래 순서의 남은 실행만 재개했다.
python3 artifacts/image-latency-20261022/resume.py
python3 artifacts/image-latency-20261022/summarize.py
```

기존 frozen runtime/receipt는 덮어쓰기를 거부한다. 재현은 별도 새 증거 경로에 protocol/입력/source/runtime을 준비해야 한다.
고정 fixture 외 사이트에 sandbox 예외를 쓰지 않았다. source/asset/runtime/receipt SHA와 raw latency/memory,
별도 profile CPU spans, 제외/실패 로그와 before/after UI 캡처를 `artifacts/image-latency-20261022/`에 보존한다.
큰 자료는 승인 NAS의 `/mnt/nas/illegal-ad/validation/image-latency-20261022/`를 쓴다.
초기 후보의 esbuild CWD 차이는 주석만 바뀐 bundle을 만들어 canonical CWD로 바로잡았고,
profile CLI 인수 순서 오류는 모델 실행 전 실패했다. 두 실패는 보존했고 formal 수치에 넣지 않았다.
전체 비교 중 긴 상위 실행이 SIGTERM(exit143)으로 중단됐다. 원인은 확인하지 못했다.
메모리 기록이 미완료된 freshPositive-after1건은 interrupted/에 보존하고 분모에서 제외했다.
완료된 receipt는 그대로 유지하고 같은 frozen runtime/harness로 남은 순서만 재개해90건을 완성했다.
첫 lint에서 새 receipt 계산의 Buffer 전역 사용2곳을 지적했다. Node 내장 Buffer를 명시적으로
import하도록 교정했다. 측정 당시 harness와 source identity는 별도로 보존하고, 이 import 한 줄
외 실행 코드가 같고 global Buffer와 같은 생성자인지 검사했다. 제품 코드/타이머/분모는 바꾸지 않았다.
이전 자료·원시 기록·모델은 덮지 않았다. 배포/제출/commit/push/PR은 실행하지 않았다.


## 최종 검증

`npm run build:scanner`, `npm run build -w apps/web`, `npm run typecheck`,
`npm run lint`, `git diff --check`가 통과했다. `KRDS_TEST_UNSANDBOXED=1 npm test`는
696 passed/1기존 skipped(93파일)이다. 실제 이미지 모델 시험은1건으로 정상 배너와
OCR 문구 perturbation, deadline 이후 정상 광고 복구, warmed 이미지 요청 중 취소를 포함했다.
선택 광고/연결 주소/하위 페이지/지연 조회의 UI 집중5tests와 실제 빌드 browser replay도 통과했다.
최종 canonical scan receipt로 재생한 ui-selected 화면에서도 실제 두 모델ID와6후보를 확인했다.
이번에는 Rust/Windows/설치 및 사람·AT 수용 시험을 재실행하지 않았다.
소스82개와 측정 당시 source/harness, 동결 실행본·모델6자산·formal90receipt·UI/문서 해시는
`delivery-audit.json`에 남긴다. 모델/참조/원문·프레임·임계값과 보호 ledger를 보존했다.
