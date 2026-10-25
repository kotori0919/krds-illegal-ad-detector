# 독립 정적검수 후 국소 보완 — 실행 전 인계

기준 검수: `/tmp/krds-product-static-review-y0t1otka/STATIC_REVIEW_KO.md`.
상태: 소스·시험 편집만 수행. 테스트/type/lint/build/browser/model/guard 실행, stage/commit 없음. HEAD/branch/worktree는 기존과 같다. 이전 semantic/OCR/holdout 실행 결과를 이 변경본 PASS로 전용하지 않는다. 실제 image-embedding 원인은 여전히 미해결이다.

## 성인광고 CTA 범위

`adult-solicitation.ts`는 기존 복원 결과의 category 원문 span을 받아 문장별로 CTA를 연결한다. `. ! ? 。 ; ,`는 문장/절 경계이며 category 원문 span 안의 점은 변형이므로 유지한다. 개행은 한 DOM 광고 owner의 배너 줄바꿈으로 본다. 각 CTA는 같은 문장의 가장 가까운 범주에만 연결하고, 두 span을 포함한 복원 텍스트 64자 이내에서 판정한다. 교육/공공 서비스 역할은 그 pair 앞뒤 최대 24 UTF16자로 국소화한다. 일반 자료(실)/상담/차단이라는 단어 자체의 전역 veto는 제거했다. 교육·보건·도서관·치료상담·차단 프로그램 등 CTA 대상/설명 역할은 보수적으로 제외한다. 차단없이/차단해제는 차단 목적과 구별한다.

부정은 각 CTA 직후의 하지마/하지말/하지않/하면안/금지/불가 등을 해당 행동에만 적용한다. 다른 CTA가 긍정이면 그것은 유지한다. 성인 CTA가 부정/인용/교육 문맥으로 기각되면 일반 가입/무료체험 offer 경로로 다시 통과시키지 않는다. qualified category만 technique용 adMatches에 남겨, 부정 안내의 점 변형을 별개의 평문 광고 CTA에 빌려 쓰지 않는다. 원문 offset과 official snippet은 그대로다.

개발 반례: 14개 positive/negative pair와 원문 span·도박/금융/도서관·국제범위 개별 3시험, 총 17시험을 `adult-context.test.ts`에 작성했다. 정적 기대값이며 미실행이다. 예시:

- 양성 가입 ↔ 가입하지 마세요/가입 불가, 무료시청 ↔ 무료시청 금지.
- 양성 자료실 신규가입 무료시청 ↔ 예방 자료 무료시청.
- 양성 상담 후 가입 즉시시청 ↔ 치료 상담 회원가입.
- 양성 차단없이 무제한시청 ↔ 차단 프로그램 회원가입.
- 같은 광고 owner의 개행 양성 ↔ `성인영상.신규가입` 별개 문장 음성.
- 무료체험 신청/제공 양성 ↔ 해당 CTA 금지 음성.
- 부정 CTA 뒤 별도 긍정 CTA는 양성, 인용된 범주를 무관한 무료체험에 빌려 쓰는 경우는 음성.

이것은 유한한 한국어 grammar이고 NLP/법적 위법성 판정은 아니다. 원거리 연결·복잡한 부정·반어·교육처럼 꾸민 광고·여러 서비스 혼합은 여전히 한계다. 영문 porn 범주/영문 JOIN NOW WATCH FREE CTA 등 국제 성인광고 커버리지는 지원하지 않는다. 기존 casino 영어 지원을 성인 영어 지원으로 확장해 설명하지 않는다. 새 cases는 구현용 반례이며 holdout이 아니다. 기존 두 평가 JSON은 수정하지 않았다.

## 정책 identity와 역사 호환

기존 공식 확장 필드 `meta.tool_version`에 `0.2.1-policy3`을 기록하고 shipped detectorPolicyVersion을 3으로 올린다. 별도 공식 필드를 추가하지 않는다. 앱 버전0.2.1/공식 schema/Case schema1/configVersion1/text-policy-2 증거 형식은 유지한다.

TS/config 및 native/config의 shipped-policy assertion을 맞췄다. Case writer/reader가 policy2를 하드코딩한 사실을 추가로 확인해 최소 호환 분기를 넣었다: `-policy2`와 과거 suffix 없는 결과는2, `-policy3`은3, 알 수 없는 policy suffix는 거부한다. manifest policyVersion은 toolVersion과 일치해야 한다. TS/native 모두 같은 규칙이며 과거 policy2 결과/fixture는 다시 쓰지 않는다. 지원진단도 실제 shipped policy를 표시한다. 이 연결을 생략하면 공식 tool_version만3인데 Case policyVersion은2로 남게 된다.

추가시험: contracts result의 기존 tool_version 확장/과거2 수용 1개, Case의 과거2/새3/불일치·미지원 버전 거부1개, native case policy mapping1개. 기존 config 기대값만3으로 갱신했다. native 저장/재개 roundtrip은 아직 실행하지 않았으며 최종 수용에 필요하다.

## OCR 진단 허용목록

error.name을 로컬 변수에 한 번 읽고 그 동일 snapshot을 검사/출력한다. changing getter/throwing getter/oversized name을 정상 stderr 상태에서 각각 시험하고 원본 cause identity와 비밀문자열 미출력을 확인하도록 3개를 추가했다. throwing getter는 진단 출력만 생략하고 기존 오류/cause를 유지한다. 이전8+신규3=11개, 새 해시 검증 필요. worker가 이미 지운 native cause는 복원하지 못하며 모델 실패를 고친 변경이 아니다.

## guard-owner 인계

실행은 부모가 승인한 canonical guard의 고정 profile을 통해서만 한다. 이 작업에서는 실행을 요청하거나 admission을 우회하지 않았다. `STATIC_CORRECTIONS_IDENTITY.json`에 파일별 SHA256과 예상 시험수를 기록했다. 고정 profile의 source identity를 명시적으로 갱신한 뒤 검증해야 한다. 새 profile 명칭/명령은 guard-owner가 확정한다.

- OCR source-level mock regression: 11개, browser/model/실제 child 없음. ocr.ts/ocr-diagnostics.ts/test 및 alias contracts 의존 소스 해시를 새로 고정할 것.
- adult-context pure regression: 17개, semantic.ts/adult-solicitation.ts/text-policy.ts와 test 해시를 고정할 것.
- contracts result/config/case: 각각 기존18+1=19 / 기존13 / 기존28+1=29 예상. 기존 shared fixtures는 유지했다. 실행자가 실제 collect count를 대조할 것.
- native mapping 새 시험1개는 향후 Rust 허용 profile과 admission 뒤 실행. type/lint 및 기존 도박/금융/브라우저/공식 JSON/Case 저장 왕복은 별도 허용 뒤 검증. 전부 현재 NOT_RUN.

예정 commit 그룹: (A) 성인 semantic+CTA helper+회귀/기존 fixture, (B) decision policy3와 TS/native 호환+회귀, (C) OCR diagnostics+11회귀. 기존 파일은 보존했고 아직 stage/commit하지 않았다.
