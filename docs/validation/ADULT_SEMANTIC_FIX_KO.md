# 성인광고 semantic 누락 국소 수정과 재현 증거

**후속 정적검수 수정 안내:** 아래 runtime 수치는 이전 소스의 이력이다. 부정 CTA/문맥/정책 identity 재수정(policy3) 뒤 아직 재실행하지 않았다. 현재 소스 PASS로 전용하지 않는다. 최신 편집 범위와 해시는 STATIC_CORRECTIONS_KO.md 및 STATIC_CORRECTIONS_IDENTITY.json을 참조한다.

기준 커밋 `ae12f7c766d8f1c7f882afb71cd93499b260729f`에서 브랜치 `fix/adult-semantic-20261026`, worktree `/home/monad/Documents/Codex/2026-10-26/task/krds-adult-semantic`을 새로 만들었다. 원본 `/home/monad/develop/illegal_ad`, 기존 안정화 worktree 및 main에는 통합하지 않았다. 최종 커밋은 이 문서를 포함하는 인도 커밋의 `git rev-parse HEAD`로 식별한다. 부모 독립 검수 전 통합 금지. push/PR/remote/배포/제출/Tasks/Windows VM 작업 없음.

## 결함과 최소 수정

독립 진단 `/tmp/krds-competition-review-ekpz6djb/COMPETITIVENESS_KO.md`, `adult-dom-observed.json`을 읽고, 실제 Chromium `setContent`의 공개 pipeline에서 수정 전 누락을 재현했다. 초기 개발 회귀 20개 중 7개 FAIL/13개 PASS: 성인 semantic 양성 6개 실패, DOM 시험의 성인 양성 5개 누락. 도박 opacity:0 및 금융 display:none 대조는 남았다. 초기 DOM 기대값에서 display:none을 TRANSPARENT로 적은 하네스 오류도 있었으며, 기존 `visibility.ts` 계약을 확인해 구현 전 OFFSCREEN으로 정정했다. 이는 성인 5개 누락과 별개다. 원본 로그 `adult-before-chromium.log`를 보존한다.

제품 변경은 `packages/detection/src/semantic.ts` 한 파일이다.

- 인구집단 단어 `성인` 자체는 범주어로 쓰지 않는다. 성인 영상/방송/사이트 및 성적 콘텐츠 서비스의 명시적 범주를 기존 정규화·자모 복원·원문 span 정렬에 넣는다.
- 해당 범주만으로 통과시키지 않는다. 같은 비인용 문장에 가입 또는 즉시/무료/무제한 시청·입장 유도가 있고, 교육·예방·보건·피해·보도·자료 등 정상 문맥이 없는 경우만 성인 광고성 근거로 삼는다. 일반 교육 회원가입, 범주 단독 언급, 인용 광고 예시는 음성이다.
- 판정은 기존 semantic AND technique 두 축을 계속 사용한다. 정상 표시된 성인광고 문구 자체는 공식 은닉기법 finding이 되지 않는다. 도박·금융 판정, URL pattern, selector/iframe/원문 추출 알고리즘은 유지했다.
- 최초 평가가 드러낸 도서관 오탐은 성인 단어가 기존 도서 대출 예외를 무효화한 회귀였다. 광고성 없는 성인 범주가 그 예외를 해제하지 않도록 수정했다.
- 공식 네 기법과 JSON 스키마, native가 수용하는 `text-policy-2` 증거 형식은 유지한다. 복원 알고리즘/offset 형식 변경 없이 범주별 semantic 조건을 확장했으며 detail에 `adult-service-solicitation-v1`을 기록한다. 예전 저장 결과를 다시 쓰지 않는다. 정책의 모든 의미 변화가 text-policy 버전으로 구별되는 것은 아니므로 재현에는 소스 SHA도 함께 사용해야 한다.

## 시험 자료 분리와 평가 범위

개발용 `adult-semantics.test.ts`: 광고 양성, 범주 언급/교육/예방/기사/도서관 음성, 네 기법, 정상 표시문, 도박·금융 대조. 실제 Chromium에서 원문, 위치의 유일성, semantic reason, CSS 및 변형 span을 확인한다.

`fixtures/adult-evaluation/cases.json`: 구현 전 정답을 고정했다. 첫 평가 TP6/FP1/FN0, 위치 7개 해석 성공 중 도서관 1개 오탐. 이를 수정에 썼으므로 **회귀셋으로 재분류**했다. 첫 실패는 `adult-first-evaluation-failed.json`에 남긴다. 이 세트를 최종 미사용 holdout이라고 부르지 않는다.

`fixtures/adult-evaluation/holdout.json`: 위 회귀 수정 뒤 별도로 작성하고 첫 실행 전에 고정했다. 해당 최초 실행 시점에는 미사용 자료였으며, 후속 정적검수 뒤 policy3로 다시 수정했다. 이 과거 실행을 최신 policy3 검증으로 전용하지 않는다. **같은 작성자의 authored holdout**이며 독립 평가자/외부/블라인드 정답셋은 아니다. SHA256 `7ce86935ff4eafbe7b80f340c41eabf1e07a12ed320bfeca589d9fa111a75c5d`.

각 세트는 top-level 3페이지 / 실제 검사 5문서(중첩 iframe 포함), 양성 6개 요소·기법 쌍이다. 두 query값의 게시판, 댓글·동일 class 반복 문구, 2단 iframe, 정상 숨김/투명/변형 텍스트를 포함한다. 양성 페이지 안의 정상 음성과 별도 정상 페이지를 함께 검사한다. 실제 production crawler → detector → official result engine/serializer를 사용하고, emitted location의 모든 frame/terminal segment가 유일한 실제 정답 DOM 노드와 일치하는지 및 raw 원문을 검사한다. 후보를 두 번 넣어도 공식 결과가 6개인지도 확인한다. 내부 gold selector 철자가 아니라 실제 노드 동일성을 비교한다.

최종 holdout: TP6/FP0/FN0, 중복0, unique locator/원문6/6. 기법별 표본은 HOMOGLYPH1, JAMO1, TRANSPARENT2, OFFSCREEN2다. 반복 요소 2개는 같은 creative이므로 독립 표본 2개라고 해석하지 않는다. 별도 외부 일반화율·심사 정확도·예상 점수 근거로 사용할 수 없다. 같은 호스트/유한 어휘/유한 template의 synthetic 결과이며 cross-origin/지연 삽입은 이 새 holdout 범위 밖이다(기존 전체 suite에 별도 회귀 존재).

시간은 crawler·검사·serializer 구간의 process 내 wall time만 기록한다. cold process 시작, UI, 영구 저장, Windows 완료 시간이나 30분 수용 시험이 아니다. 이미지/OCR/실사이트의 성인 광고 정확도도 측정하지 않았다. 새 성인 이미지 수집/외부 광고 링크 탐색은 하지 않았다.

## 실행 환경과 재현

종속성은 기존 로컬 설치를 isolated worktree로 복사해 사용했다(새 install/lockfile 변경 없음). 최초 scanner build는 새 worktree의 model cache 부재와 DNS ENOTFOUND로 FAIL했다. 안정화 worktree의 기존 model cache를 이 worktree에 복사한 뒤 빌드 스크립트의 pinned byte/hash 검증을 거쳐 PASS했다. 초기 typecheck는 앱의 별도 node_modules 누락으로 FAIL했고 기존 앱 종속성을 별도 복사한 후 PASS했다. 소스 결함 실패와 환경 준비 실패를 혼동하지 않는다.

이 호스트의 sandbox 내부 Chromium 시작은 `Operation not permitted`로 FAIL했다. 기존 테스트 전용 `KRDS_TEST_UNSANDBOXED=1` opt-in과 승인된 실행 환경에서 controlled local fixture만 검사했다. production sandbox/worker 코드는 변경하지 않았다. Chromium 버전·Node·예외 여부는 JSON에 기록한다.

아래는 최초 실행 이력이다. 복구 이후 직접 재실행은 금지이며, guard 독립검수 및 부모 실행 승인 뒤 모든 build/test/embedding/archive는 `task-2/krds-workload-guard.py` 경로로만 실행해야 한다. 현재 자원은 일반 admission 조건을 충족하지 않는다. 상세는 `OCR_FAILURE_ANALYSIS_KO.md` 참조.

과거 worktree root 실행 명령:

```sh
npm run build:scanner
KRDS_TEST_UNSANDBOXED=1 KRDS_ADULT_EVALUATION_REPORT=/tmp/krds-adult-final npx vitest run packages/detection/test/adult-semantics.test.ts packages/detection/test/adult-evaluation.test.ts packages/detection/test/detection.test.ts packages/detection/test/text-policy.test.ts
KRDS_TEST_UNSANDBOXED=1 nice -n 10 npm test -- --maxWorkers=1
npm run typecheck
npm run lint
npm run build
npm run build:scanner
git diff --check
```

테스트 파일 순차 설정과 단일 worker/낮은 우선순위를 사용했다. 전체 suite 안의 기존 검사는 자체 bounded concurrency를 시험할 수 있다. 별도 대형 benchmark는 반복하지 않았다.

최종 실행 결과: 관련56 PASS; 전체819 PASS/1 FAIL/1 SKIP(OCR 원인 미확정). 최종 소스 기준 type/lint/build 재실행 및 로컬 커밋은 PENDING. 이전 중간본 type/lint/scanner build PASS를 최종본 PASS로 간주하지 않는다. 복구 후 무거운 작업은 실행하지 않았다.

## 잔여 한계

이 구현은 법적 위법성 분류기나 범용 자연어 모델이 아니다. 명시된 범주/가입·시청 유도를 벗어나는 은어·이미지·다른 언어, 광고와 교육 표현이 한 문장에 섞인 회피 문구는 누락될 수 있다. 보수적인 public context 규칙 때문에 정상 문맥을 모방한 실제 광고도 누락될 수 있다. 반대로 동일 패턴으로 작성한 정상 콘텐츠의 오탐 가능성을 유한 표본0건으로 배제할 수 없다. 이번 국소 수정이 실제 심사 실행물에 들어가는지와 CPU Windows 수용은 부모의 별도 작업이다. Windows/Excel/installer/UI cold 완료/실제 제출본 갱신은 NOT_RUN이다.
