# OCR 중복 연산과 CPU 최적화 (2026-10-22)

최종 구성은 기존 FP32 문자·8비트 가중치 vision/cap8을 유지하고 PP-OCR 구현의 중복 순회와
좌표 계산을 줄인다. 모든 원문·대체 원문·신뢰도·GIF 프레임/시각·판정 경로와 점수는 보존했다.
메모리 arena를 켜는 두 후보는 이득 대비 메모리 비용 때문에 기각했다. Windows는 내일로 미뤘다.

## 병목과 변경

수정 전 실행본/source를 먼저 동결하고 새 GNUtime 기반 baseline과 별도 진단 profile을 실행했다.
저해상도6개 진단에서 PP-OCR10회 중 detector2.100초/recognizer0.619초 외에
보간352.0ms, 확률 배열 검증213.9ms, 영역 후처리76.3ms, CTC 문자 선택17.4ms가 있었다.
인식 입력73개의 모양·내용 SHA를 비교했지만 같은 입력 재호출은0이었다. 이를 근거로
인식 결과 캐시는 추가하지 않았다. 기존 SHA 기반 이미지 중복 제거는 그대로다.

`packages/evidence/src/neural-ocr.ts`에서 다음을 바꿨다.

- 확률 배열의 구조/길이/자료형 검증은 유지하고, 값 검증을 detector mask 및 CTC가 값을 읽는
  순회에 합쳤다. 선택되지 않은 확률과 blank도 모두 검사한다. 범위 비교 두 개가 NaN/Inf도
  거부하므로 중복 유한성 검사를 없앴다. 허용 범위±1e-6, CTC 반복/blank/동점 우선순위,
  confidence 계산 순서와0.5기준은 유지했다.
- bilinear x좌표·보간 비율을 한 번 계산해 모든 행에 재사용한다. Float64로 같은 계산 순서를
  보존하며 BGR/CHW, 픽셀 반올림·패딩·detector upscale/4x크기와 상한은 그대로다.
- 입력/출력 tensor를 성공·예외·deadline 모두의 finally에서 해제한다. 소비가 끝난 뒤에만
  해제하며 모델 세션·serial 큐·취소/child 종료 경계는 유지한다.

최종 별도 진단에서 보간273.1ms, 구조 검증0.7ms, 영역+값 검사92.3ms,
CTC+값 검사64.1ms였다. 기존 검증+영역+CTC307.6→157.1ms, 보간352.0→273.1ms다.
PP-OCR 전체 진단은3.929→3.702초였다. detector/recognizer 호출 수10/73은 같았다.
이는 계측을 넣은 N1 진단이며 아래 전체 처리 비교에 섞지 않았다. 큰 CPU 비용은 여전히
vision 추론이 차지하므로 OCR 개선을 전체 CPU의 큰 비율 절감으로 설명하지 않는다.

## 기각 후보와 근거

같은6PNG를 default/4x 각각 인식한12요청으로 ONNX Runtime CPU arena 재사용을 분리 비교했다.
실제 scan이 항상12회를 호출한다는 뜻은 아니다. 모델 초기화 이후 인식 구간만 process.cpuUsage로
재고 각 새 프로세스의 resourceUsage 최대 RSS/minor faults를 기록했다. 구성별 warmup을 버리고
5회 교차 비교했다. 한 시리즈에서 두 모델을, 별도 시리즈에서 인식기에만 arena를 켰다.

| 후보 | OCR CPU 초 중앙값 | 최대 RSS MiB 중앙값 | minor page faults 중앙값 |
|---|---:|---:|---:|
| 두 모델 재사용 | 3.518 → 3.125 | 500.0 → 714.3 | 753606 → 164974 |
| 인식기만 재사용 | 3.476 → 3.477 | 501.1 → 553.5 | 771643 → 766672 |

전체 arena는 CPU 약0.39초를 줄였지만 약214MiB를 추가 점유했다. 인식기만 켠 후보는
CPU/처리 시간의 이점이 뚜렷하지 않고 약52MiB가 늘었다. 최종은 기존 arena OFF다.
원문/신뢰도는 두 비교시리즈 모두 같았다. 이 값들은 아래 브라우저 포함 CPU와 범위가 다르다.
미지원 Node extra 설정이나 새 backend/런타임/모델/튜닝 threshold를 도입하지 않았다.

## 정확도와 GIF

같은190입력/29묶음을 전후 비교했다. 실제60/60·정상 오탐0/74,
별도 파생17/18·정상 오탐0/38이 유지됐다. 모든 수집·OCR·대체 OCR·의미 비교는 완료됐고,
원문/신뢰도/엔진, 선택 프레임/시각/순서·출처/연결 주소·판정 경로가 같다.
점수 성분 최대 절대 차이는 {'textEmbedding': 0.0, 'visualEmbedding': 0.0}로 사전에 고정한1e-5 이내다.
각 scan은 먼저 commit한 공식 JSON 바이트를 끝까지 보존했다.

보간은154개의 bounded PNG 전체/offset crop308텐서에서 바이트 단위로 대조했다.
GIF/JPEG 등36입력은 이 보간 단독 시험에서 제외하고 canonical 수집/변환 경로로 비교했다.
실제 최신6배너 진단의 recognizer 입력73개는 모양·SHA·순서까지 같았다.
CTC 시험은 NaN/Inf/범위 위반을 비선택값·blank·뒤 step에 넣어 모두 거부하는지,
반복/blank/최저 index 동점/실제 Float32 confidence를 확인한다.

파생 GIF3개와 추가 프레임 대조4개, 정상 GIF의 프레임/시각과 기존 ANIMATION_PARTIAL 표시는
유지했다. 검사 프레임·pixel·모델 호출을 줄여 시간을 단축하지 않았다.
BUTTER의 극단 축소 파생1건은 양쪽 모두 누락했고 원본 탐지는 유지했다.
190개는 기존 개발/회귀 자료이며 일부 참조와 겹친다. 새 독립 정확도·모집단 탐지율·법적 위반
확정률을 뜻하지 않는다. 새 불법광고 원본 GIF나 현재 차단 사이트를 새로 수집하지 않았다.

## 전체 처리·CPU·메모리

같은 Ryzen7 9700X8코어/16논리CPU·약32GB RAM/Linux/Node26.8.1/ORT Node1.30.0/CPU,
같은 NAS·입력·모델·참조·warm 파일 캐시에서 각 scan을 새 브라우저/worker로 실행했다.
vision cap8/text2/1/neural1/1, 모든 예산/정책/공공안내·일반 광고·DOM 제외 규칙은 유지했다.
대표5묶음 각 전후5회, 비성능24묶음 각 전후1회로98 formal receipt다.
초기 latestPositive/newPositive20개는 같은 최종 runtime에서 측정했고 남은78개를 원래
교차 순서로 이어 실행했다. warmup·별도 profile·arena probe는 분모에 넣지 않았다.

전체 시간은 scanSite 호출부터 워커 정리를 포함한 종료까지다. GNUtime user+system CPU는
Node scan과 재수거한 Chromium/OCR/native 하위 프로세스·모든 native thread를 합한다.
CPU초는 여러 코어 사용으로 벽시계 초보다 클 수 있다. startup/fixture 준비/타이머 이후
receipt 작업도 CPU에는 포함되고 외부 메모리 sampler 부모는 제외된다. 분해능0.01초다.
같은 GNUtime wrapper/25ms 메모리 샘플링을 전후에 적용했다.
OCR worker VmHWM은 종료 전 관측 최대라 최종 순간을 놓칠 수 있다. 트리 RSS 합은 공유
페이지 중복이며 PSS/물리 점유량이 아니다. 전체 raw에는 user/system·GNU 최대 개별 RSS도 있다.

| 묶음 | 지표 | 전 중앙값 (최소–최대) | 후 중앙값 (최소–최대) | 쌍별 차이 중앙값 (최소–최대) |
|---|---|---:|---:|---:|
| 저해상도 배너6개 | 전체 초 | 10.359 (10.347–10.454) | 10.099 (10.058–10.293) | -0.258 (-0.395–-0.154) |
| 저해상도 배너6개 | CPU 초 | 42.600 (42.210–42.980) | 42.240 (41.690–42.870) | -0.360 (-0.740–-0.110) |
| 저해상도 배너6개 | 워커 VmHWM MiB | 1774.375 (1772.141–1789.516) | 1728.129 (1713.273–1737.773) | -45.406 (-64.910–-35.605) |
| 기존 추가 배너6개 | 전체 초 | 6.799 (6.788–6.912) | 6.783 (6.746–6.836) | -0.032 (-0.166–0.039) |
| 기존 추가 배너6개 | CPU 초 | 7.960 (7.940–8.080) | 7.970 (7.890–8.090) | -0.040 (-0.190–0.140) |
| 기존 추가 배너6개 | 워커 VmHWM MiB | 1109.562 (1104.605–1157.887) | 1110.066 (1102.602–1144.855) | 0.504 (-45.895–40.250) |
| 파생 GIF3개 | 전체 초 | 1.584 (1.537–1.601) | 1.556 (1.510–1.663) | 0.012 (-0.074–0.063) |
| 파생 GIF3개 | CPU 초 | 2.030 (1.980–2.080) | 1.980 (1.950–2.010) | -0.070 (-0.100–0.020) |
| 파생 GIF3개 | 워커 VmHWM MiB | 504.602 (493.422–533.137) | 497.766 (484.426–520.762) | -7.129 (-30.969–27.340) |
| 기존 추가 배너5개 | 전체 초 | 4.824 (4.801–4.993) | 4.764 (4.694–4.888) | -0.105 (-0.184–-0.029) |
| 기존 추가 배너5개 | CPU 초 | 5.950 (5.920–6.170) | 5.820 (5.740–6.060) | -0.120 (-0.180–-0.110) |
| 기존 추가 배너5개 | 워커 VmHWM MiB | 1397.891 (1384.246–1401.941) | 1391.684 (1328.066–1401.895) | -2.711 (-69.824–7.438) |
| 실제 정상 광고6개 | 전체 초 | 2.382 (2.343–2.428) | 2.360 (2.331–2.423) | 0.008 (-0.072–0.025) |
| 실제 정상 광고6개 | CPU 초 | 3.270 (3.150–3.370) | 3.240 (3.140–3.350) | 0.040 (-0.230–0.050) |
| 실제 정상 광고6개 | 워커 VmHWM MiB | 1156.020 (1100.480–1156.742) | 1135.676 (1098.660–1151.441) | -16.770 (-58.082–50.961) |

음수는 절감이다. 쌍별 차이가0을 넘나들거나 분산에 묻히는 작은 값은 개선으로 주장하지 않는다.
neural OCR을 쓰지 않는 묶음의 작은 변동도 이 변경의 효과로 설명하지 않는다.
formal 비교 중 다른 소유 모델/빌드/테스트/UI replay를 실행하지 않았다. 다른 데스크톱·MCP
서비스와 전력/온도/affinity는 고정하지 못했다. 첫 계측 후보에서 model session 준비가
비정상적으로 길었고 전체14.46초였다. 원인은 확정하지 못했고 diagnostic1에 보존했다.
선택/성능 결론은 새 교차N5와 최종 runtime을 사용했다. cold 설치·다른 CPU·Windows는 미측정이다.

## UI/UX

간단 모드에서도 이미지 근거 안의 다른 OCR 원문을 native details로 펼쳐 볼 수 있다.
고급 모드 전환 없이 선택 원문과 저장된 대체 원문을 직접 비교한다. 원문을 요약하거나 합치지
않으며, 실패한 인식은 기존 실패 안내로 표시한다. 긴 원문은 필요할 때만 펼치고 원본 이미지·
관측 연결 주소·출처와 기존 지연 조회/번호/aria-controls를 유지한다.
키보드 Enter 열기/닫기와 원문 바이트 보존, 추가 backend 호출 없음, 320/768/1024/1440px
가로 넘침0을 실제 web build/Tauri adapter replay로 검증했다. 이번 목록 밀도 목표는 유지다.
617건 모드 기억·필터·메모·관계 복귀·공식 JSON/엑셀618행도 확인했다. 일반 점검 WARP 선택과
기존 단일 사례 인프라 범위는 유지한다. Windows/native/사람·보조기기 수용 시험은 미실행이다.

## 재현과 증거

`artifacts/ocr-cpu-20261022/`의 protocol/input/source identity와 frozen runtime,
GNUtime sidecar·원시 receipt·CPU spans·tensor parity·arena 후보·UI 캡처를 보존한다.
대형 원시 자료는 승인된 `<external-evidence>/illegal-ad/validation/ocr-cpu-20261022/`에 있다.
기존 이미지 지연 최적화/양자화/학습 참조/원시 자료는 덮어쓰지 않았다.

```sh
EMBEDDING_BENCH_DIR=artifacts/ocr-cpu-20261022 node benchmarks/embedding-precompute.mjs --freeze before
EMBEDDING_BENCH_DIR=artifacts/ocr-cpu-20261022 node benchmarks/embedding-precompute.mjs --freeze before --profile
EMBEDDING_BENCH_DIR=artifacts/ocr-cpu-20261022 EMBEDDING_CPU_TIME=1 KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs --profile before
node artifacts/ocr-cpu-20261022/probe-neural.mjs
node artifacts/ocr-cpu-20261022/arena-probe.mjs
node artifacts/ocr-cpu-20261022/arena-probe.mjs --rec
npm run build:scanner
EMBEDDING_BENCH_DIR=artifacts/ocr-cpu-20261022 node benchmarks/embedding-precompute.mjs --freeze after
EMBEDDING_BENCH_DIR=artifacts/ocr-cpu-20261022 EMBEDDING_CPU_TIME=1 EMBEDDING_GROUPS=latestPositive,newPositive KRDS_TEST_UNSANDBOXED=1 node benchmarks/embedding-precompute.mjs
python3 artifacts/ocr-cpu-20261022/resume.py
python3 artifacts/ocr-cpu-20261022/summarize.py
```

실제 실행 순서는 protocol/log에 기록돼 있다. 동결본과 receipt 덮어쓰기는 거부하므로 재현은
새 증거 디렉터리를 준비해야 한다. Linux sandbox 예외는 소유 loopback fixture에만 적용했다.
배포·설치·제출·commit/push/PR·외부 능동 탐색은 실행하지 않았다.


## 최종 검증

`npm run build:scanner`, 웹 build, `npm run typecheck`, `npm run lint`,
`git diff --check`가 통과했다. 최종 `KRDS_TEST_UNSANDBOXED=1 npm test`는
699 passed/1기존 skipped(95파일)이다. NaN/native 오류 뒤 실제 tensor의 접근 불가 상태로
해제를 확인하고, 다음 큐의 정상 요청이 복구되는 자원 경계 시험도 통과했다. 모델/파일 경계의
고의 오류만 fake inference로 대체했고 실제 corpus 추론/검증은 모두 실제 모델이다.

첫 전체 회귀에는2실패가 있었다. 화면 시험은 기존에 대체 원문이 DOM에 없다고 기대해
새 접기 기능과 충돌했다. 선택 원문은 펼쳐진 근거에, 대체 원문은 닫힌 details 안에 별도로
보존되는지를 검사하도록 갱신했고 실제 키보드 열기/닫기도 통과했다. 다른1건은 기존9페이지
수집 시험에서 기대한15관측 대신14관측이 나온 경우다. 고유 OCR7건은 유지됐다.
수집/GIF 코드는 이번에 변경하지 않았다. 해당 시험 단독 통과 및 수정 전·후 동결본을
각3회 비교한6실행 모두15관측/7OCR이었다. 최초 변동의 원인은 재현·확정하지 못했고
영구적인 수집 수정으로 해결했다고 주장하지 않는다. 최초 실패와 재현 로그를 보존했다.
최종 전체 회귀는 기존 수집 기준을 바꾸지 않은 상태에서 통과했다.

최종 소스85개, 동결 실행본, PP-OCR 모델/사전과 Gemma자산,98formal receipt/원시CPU/profile,
308텐서·73실제 인식입력의 바이트/hash 일치 및 UI/문서 해시는 delivery-audit.json으로 연결한다.
Rust/Windows/설치·기관/사람·AT 수용 시험은 이번에 재실행하지 않았다.
