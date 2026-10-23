# Gemma 선택적 8비트 양자화 비교 (2026-10-22)

최종 구성은 **문자 인코더 FP32 + 이미지 인코더 8비트 가중치**다. 전체 문자·이미지 INT8 후보는 경계 문구에서 선택 원문과 탐지 경로를 바꾸어 기각했다. 임계값·참조 사례·공공안내 제외 규칙을 변경하지 않았다. Windows는 사용자 요청에 따라 다음 날로 미뤘다.

## 구성과 원인

같은 `onnx-community/embeddinggemma-2-ONNX`의 고정 revision `daa72c51243991dfcaf9f9137d2c573d8f7790c0`을 사용한다. `model.onnx`는 FP32, `vision_encoder_quantized.onnx`는 `MatMulNBits(bits=8, block_size=32)`와 `GatherBlockQuantized`를 사용한다. 압축 가중치는 UINT8로 저장되며 그래프 입출력은 FP32다. 일부 연산/가중치는 FP32를 유지하므로 모든 연산이 INT8인 구성으로 설명하지 않는다. ONNX Runtime Node1.30.0/CPU2 intra-op·1 inter-op, Node26.8.1, Ryzen7 9700X8코어/16스레드, 약32GB RAM이다. GPU·학습·미세조정·평가자료 기반 보정은 없다.

BC.GAME의 같은 4x OCR 원문을 직접 넣으면 FP32 문자 margin은 `+0.0006152613`, 전체 INT8은 `-0.0000765616`이었다. 차이는 작지만 기존 기준0에서 부호가 바뀌었다. 전체 INT8 점검도 최종 양성은 유지했으나 더 약한 원문을 선택하고 약5.49초의 이미지 fallback을 추가했다. 그러므로 최종 양성 개수만 보고 채택하지 않고, 문자 인코더를 FP32로 보존했다. `bcgame-*-probe.json` 및 `int8-both-*`에 기각 후보를 보존했다.

20개 고정 문구/4개 배치와52개 이미지 참조(26개 고정 이미지 및26개 픽셀 섞기)를 동일하게 사용했다. 이미지 참조는 기존에 동결한 원본과 model-input SHA를 확인해 새 인코더로 다시 계산했다. 사례·문구·라벨·shuffle seed1701·이미지 전처리·OCR/예산·임계값은 유지했다. 생성은 `npm run prepare:embedding-references`, 정상 빌드는 핀 크기/SHA 및 참조 manifest/content hash를 검증한다. 점검 중 모델 다운로드/참조 생성은 없다.

문자 참조15360성분의 최대 절대 차이는 0.0; 이미지 참조 최저 코사인은 0.995148010다. 실행 전 정한 gate는 참조 코사인≥0.95, 전후 점수 성분 차이≤0.08, 같은 구성 반복≤1e-5, 원문/프레임/판정 동일이다. 0.08은 분류 임계값이 아니며 판정 변경을 허용하지 않는다. 관측 최대 차이는 0.006846605, 반복 최대 차이 0.000000000; 종류별 최대는 `{'textEmbedding': 0.0, 'visualEmbedding': 0.00684660503829948}`이다.

## 품질

| 자료 | FP32 | 선택적 양자화 |
|---|---:|---:|
| 실제 출처 불법광고 배너 | 60/60 | 60/60 |
| 실제 정상 광고 오탐 | 0/74 | 0/74 |
| 별도 파생 양성 대조군 | 17/18 | 17/18 |
| 별도 파생 정상 대조군 오탐 | 0/38 | 0/38 |

190개 입력 모두 수집됐으며 선택된 OCR·대체 OCR·GIF 프레임/시각·문구·판정 경로가 같았다. 보조 모델은 모두 available이었다. 파생 GIF3개와 추가 프레임 대조4개는 모두 탐지했다. 이들은 실제 배너 픽셀로 만든 대조군이며 새로 수집한 불법광고 원본 GIF가 아니다. 기존 BUTTER 전체 가로 배너를137×42로 극단 축소한 파생1건은 양쪽 모두 누락했다. 원본 BUTTER 탐지는 유지했다.

이 표는 양자화 비교(2026-10-22, `56fd356`) 시점의 측정이다. 이후 추가된 `depositCreativeTerms`(be9c14a)와 그 앵커 축소를 포함한 `ee123bb`에서 같은 190입력을 다시 재생한 결과도 실제60/60·정상 오탐0/74·파생17/18·파생 정상 오탐0/38로 같았고, 판정이 바뀐7행은 모두 v4→v3로 강화된 양성이다(`docs/VISION_CPU_OPTIMIZATION_20261022.md`).

190개는 이전에 사용한 개발/회귀 자료이고 일부 참조 사례와 겹친다. 역사적 fresh/heldout/unseen 이름은 이번 비교에서 새 독립 평가를 뜻하지 않는다. 실제 광고 자료를 소유한 loopback 페이지로 재생한 결과이며 현재 차단된 사이트에서 실시간 수집하거나 광고 대상에 접속한 결과가 아니다. 추가 검토 후보를 포함한 탐지율이며 법적 위반 확정률이나 모집단 정확도로 일반화할 수 없다.

## 처리 시간

소유한 테스트·다른 모델 실행을 모두 끝내고, 같은 NAS/기기에서 각 묶음5회씩 순서를 번갈아 실행했다. 각 점검은 새 브라우저·OCR child를 사용하고 파일 캐시는 warm이다. 전체 점검 종료/child 정리까지 포함한다. 고정 모델 전체를 사용하는 warmup을 구성별1회 버렸다. 다른 데스크톱/Chrome 활동 및 전력·온도는 통제하지 못했다.

| 묶음 | FP32 초 중앙값 (최소–최대) | 선택적 양자화 초 중앙값 (최소–최대) | 쌍별 차이 초 중앙값 (최소–최대) |
|---|---:|---:|---:|
| 저해상도 배너 6개 | 15.901 (15.785–15.988) | 15.933 (15.895–16.048) | 0.045 (-0.038–0.154) |
| 파생 GIF 3개 | 1.591 (1.577–1.613) | 1.579 (1.568–1.594) | -0.012 (-0.038–0.004) |
| 기존 추가 배너 5개 | 4.827 (4.814–4.893) | 4.825 (4.807–4.834) | -0.002 (-0.086–0.009) |
| 실제 정상 광고 6개 | 2.392 (2.345–2.542) | 2.359 (2.335–2.584) | -0.017 (-0.041–0.042) |

음수 차이는 단축이다. 쌍별 차이에 양·음이 섞이거나 차이가 분산에 묻히면 속도 개선으로 주장하지 않는다. GIF 대조군에서는 Gemma를 호출하지 않았으며, 이미지 인코더가 호출되지 않는 묶음에는 이 양자화의 효과를 기대하지 않는다. 전체190개를 반복한 처리 시간으로 외삽하지 않는다.

## 메모리와 자산 크기

Linux procfs를 외부 부모에서25ms마다 읽었다. OCR child VmHWM은 종료 전 관측한 최대값이며 마지막 순간 peak를 놓칠 수 있다. 전체 프로세스 트리 RSS 합은 공유 페이지를 중복 계산하므로 물리 메모리/PSS가 아니다. 모든 시간 실행에 같은 샘플링을 적용했다. 아래는5회 중앙값이다.

| 묶음 | OCR child VmHWM MiB FP32→양자화 | 프로세스 트리 RSS MiB FP32→양자화 |
|---|---:|---:|
| 저해상도 배너 6개 | 2181.1 → 1778.5 | 2383.8 → 2000.1 |
| 파생 GIF 3개 | 505.9 → 508.7 | 699.6 → 693.5 |
| 기존 추가 배너 5개 | 1391.3 → 1388.4 | 1646.7 → 1650.9 |
| 실제 정상 광고 6개 | 1104.0 → 1093.7 | 1374.9 → 1349.7 |

고정한 모델/토크나이저6파일은 1,787,911,199→1,312,154,937바이트(-26.6%)다. 전체 Windows 설치 파일 크기나 설치 후 실제 점유량 측정은 아니다. 각 메모리 지표의 최소/중앙/최대 및 쌍별 분산은 `summary.json`에 보존했다.

FP32 세 번째 저해상도 실행1건에서는 원본 PNG 대신 화면 캡처 PNG가 수집되어 컨테이너 SHA가 달랐다. 별도 소유 loopback에서 그 캡처의 정확히 같은SHA 파일을 재현했고, 디코딩 RGBA와 원본/픽셀섞기 모델 입력 텐서가 바이트 단위로 같음을 검증했다. `capture-parity.json`/두PNG/검증 스크립트를 보존했다. 원시receipt와자산SHA는 수정하지 않고 이 입증된 한 쌍만 비교 시 픽셀 동등으로 취급한다. 이 차이는 모델 경로나 판정 차이로 숨기지 않았으며, 전체 시간에는 실제 수집 변동을 포함한다.

## UI/UX와 실행 경로

추가 단서의 근거 버튼에 번호와 고유 `aria-controls`를 연결했다. 긴 원문(240자 초과 또는4줄 초과)은 전체 보기로 접고, 짧은 원문은 계속 바로 표시한다. 전체 원문과 저장된 JSON/이미지 바이트는 보존했다. 동일한6배너 FP32 receipt로 비교한1366px 화면에서 첫3카드 하단은1910.89→1575.64px, 문서 높이는3324→2988px이었다. 320/768/1024/1440px 넘침0, 320px 근거 값 너비256px, 열기 전 근거 조회0, 키보드 열기/닫기와 원문 전체 보기에서 바이트 보존을 검증했다. 간단·고급 모드 및 기본 연결/WARP 선택 흐름을 유지했다.

모델은 `packages/evidence/src/text-embedding.ts`의 동일한 OCR child 경로에 있다. `text-reference-data.ts`가 모델과 참조의 혼합/손상을 거부한다. `manifest.json`과 `build-ocr-worker.mjs`가 고정 자산을 배치한다. 실제 이미지 근거에는 `embeddinggemma-2-image-text-f32-vision-int8`을 기록하며 문자 근거는 기존FP32 ID다. TS/Rust는 새 V3 ID와 역사적 FP32 기록을 구분해서 읽는다. 유사도를 OCR 복구나 법적 판단으로 표시하지 않는다.

## 실행 및 증거

`artifacts/embedding-quantization-20261022/`에 protocol/input/source identity, pinned upstream tree/graph inspection, reference parity, 환경, raw quality/baseline/runs/warmups, summary/audit를 보존했다. 큰 모델과 원시 실행 자료는 승인NAS를 사용한다.

품질은 변경 전 FP32 전체 baseline 중 비성능25묶음을 재사용하고 같은25묶음의 혼합 후보를 실행했다. 성능4묶음은 새 paired N5를 실행했다. 총90논리 receipt(25×2 +4×5×2)이며, 새 시간40receipt에만 메모리 샘플이 있다. 별도2warmup/기각 후보 부분 시리즈/직접probe를 품질 분모나 성능 중앙값에 섞지 않았다.

실행 명령:

```sh
npm run prepare:embedding-references
npm run build:scanner
EMBEDDING_BENCH_DIR=artifacts/embedding-quantization-20261022 node benchmarks/embedding-precompute.mjs --freeze after
# 각 비성능 그룹의 품질 receipt; GROUP/NEW_RECEIPT는 새 경로를 지정한다.
EMBEDDING_BENCH_DIR=artifacts/embedding-quantization-20261022 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs --scan after GROUP 1 NEW_RECEIPT
EMBEDDING_BENCH_DIR=artifacts/embedding-quantization-20261022 EMBEDDING_GROUPS=latestPositive,derivedGif,heldoutPositive,heldoutNormal KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs
python3 artifacts/embedding-quantization-20261022/summarize.py
```

동결 및 시간 receipt 덮어쓰기는 거부한다. 재실행은 새로운 증거 디렉터리와 명시적 protocol/input/runtime을 준비한다. Linux 샌드박스 예외는 소유한 loopback 자료에만 허용했다. 원본 GIF 새 수집·능동 외부 탐색·Windows·설치/배포·제출·commit/push/PR은 실행하지 않았다.

자료: [고정 upstream ONNX 파일](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/tree/daa72c51243991dfcaf9f9137d2c573d8f7790c0/onnx), [ONNX Runtime 양자화 문서](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html). 실제 비트 수/연산/입출력은 내려받은 고정 그래프를 직접 검사했다.


## 최종 검증

`npm run build:scanner`, `npm run typecheck`, `npm run lint`, 웹 build가 통과했다.
`KRDS_TEST_UNSANDBOXED=1 npm test`는696 passed/1기존 skipped(93파일),
Linux Rust 공유 근거 harness의8 tests가 통과했다. 샌드박스 예외는 소유 loopback fixture에만 적용했다.
첫 full-test 실행은 이 환경에서 필요한 시험용 설정 누락으로 브라우저 실행에 실패했다.
제품 격리 정책은 변경하지 않고 기존 fixture 설정으로 재실행했다. 실패 로그도 보존했다.

FP32 동일 receipt UI전후와 실제 선택적 양자화 receipt UI연동이 모두 통과했다.
선택적 양자화 화면은 text-f32와image-text-f32-vision-int8 ID를 실제로 읽고6검토후보를 표시했다.
키보드로 개별 근거 열기/닫기, 긴 원문 전체 보기, 원시 이미지 바이트 동일, 외부요청0/WARP0/pageerror0을 확인했다.
617건 기존 결과에서도 모드 기억, 메모·필터·단일 사례 관계 화면 복귀, 원본JSON 바이트 및 엑셀618행 보존,
1366×768에서 첫3행하단759.875px와360px 가로넘침0을 확인했다.

초기 준비에서 없는 `python` 별칭 때문에 설정 단계가 실패했고 뒤따른 동결 명령이 과거 실행본을 덮었다.
즉시 보관된 원본 실행본에서 복구해 기존 source-identity의 SHA256(08f5af5a worker/3e8fb728 scanner)과 일치함을 검사했다.
과거 원시 측정·데이터·가중치는 변경하지 않았다. `setup-correction.txt`와 인수인계에 기록했다.
전체INT8 기각, 혼합후보의 모델/입력 검사, PNG 컨테이너 동등 검증과 시험 selector 수정의 중간 로그도 유지했다.

이번 채택은 메모리/모델 자산 크기 절감이며 전체 처리 속도 개선으로 설명하지 않는다.
새 원본 GIF·독립 출처 정확도·Windows 및 설치/업그레이드 크기 검증은 포함하지 않는다.
