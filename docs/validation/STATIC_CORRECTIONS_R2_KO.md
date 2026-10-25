# 재검수 후 revision 2 — 두 결함만 편집, 실행 전

기준: `/tmp/krds-corrections-rereview-1a8qz53h/REREVIEW_KO.md`.
부모가 보고한 5파일 89/89 PASS는 revision1 snapshot에만 귀속한다. 이번 변경 후 새 시험 결과는 NOT_RUN이다. 테스트/브라우저/모델/build/guard 실행 및 stage/commit/main통합/push는 하지 않았다. OCR/native 이미지 임베딩 원인은 이번 범위와 별개로 미해결이다.

## 부정 CTA의 가까운 수식 변형

`adult-solicitation.ts`의 기존 CTA 직후 부정 grammar에만 강조 부사를 추가했다. 복원 텍스트에서 `CTA + 조사0~1 + 강조부사0~2 + 부정 술어`를 처리한다. 강조 부사는 절대(로)/결코/반드시/무조건으로 한정하므로 최대6자(조사 포함7자) 안에서 부정이 시작한다. 부정 술어가 없으면 부사는 광고를 거부하지 않는다. 기존 하지마/하지말 접두가 하지 말아 주세요를, 금지 접두가 금지됨을 포함한다. 원거리 문맥·국제어·반어 전반으로 범위를 넓히지 않았다.

- 추가 음성8개: 가입 절대 금지, 무료시청 절대 하지 마세요/절대로 하지 마세요, 가입은 절대 금지됨, 가입하지 말아 주세요, 가입 금지됨, 가입 절대 반드시 불가, 무료시청 무조건 금지.
- 별도 긍정 CTA 보존1시험: `성인방송 가입 절대 금지. 성인영상 무료시청`의 둘째 CTA/원문 span만 유지.
- 부사/차단회피 보존1시험: 가입 무조건 혜택 제공, 무료시청 반드시 제공, 차단없이 무제한시청은 양성으로 기대.

기존17+신규10=adult-context **27시험 예상**. 실제 collect/실행은 guard-owner가 확인해야 한다. 차단없이의 정보역할 예외/CTA 매칭 자체는 바꾸지 않았고, CTA 뒤 부정 검사도 강조 부사만으로 veto하지 않는다.

## Case 필수 정책값

`isCaseManifest`가 decisionPolicy 결과를 먼저 캡처해 undefined를 명시적으로 거부한다. policyVersion도 정수로 존재하고 지원 정책 결과와 일치해야 한다. 이로써 `undefined===undefined` 통과 경로를 제거한다. 기존 known policy2/3, suffix 없는 역사 policy2, unknown suffix 거부 규칙은 유지한다.

TS에 policy2/3/4 × missing/undefined/null 9개 시험을 추가했다. 각 경우 official 인자 없이도, tool_version을 맞춘 official 인자를 주어도 거부해야 한다. 기존29+신규9=Case **38시험 예상**.

native는 policy_version:u32 역직렬화가 이미 missing/null을 거부하므로 제품 validator를 바꾸지 않았다. 동일 policy2/3/4 × missing/null 테이블의 역직렬화 거부를 검사하는 Rust시험1개만 추가했다. JS undefined는 JSON 표현이 없어 native에서는 필드 누락에 대응한다. 기존 mapping1+신규1=목표 native 시험2개이며 전체 native suite 수는 별도다.

## 고정 profile 인계와 보존

기존 `STATIC_CORRECTIONS_IDENTITY.json`의 바이트를 `STATIC_CORRECTIONS_IDENTITY.r1.json`에 보존했다. 이전 manifest SHA256은 `15fef6414593d7e4fe04761822cde794d763de70aa6cb68941b14a391d19786b`이다. 과거 시험 결과 파일은 수정하지 않았다.

canonical manifest를 revision2로 갱신하고 `STATIC_CORRECTIONS_IDENTITY.r2.json`에도 같은 바이트를 둔다. 기존23개 file identity 키를 유지하며 이 패스에서 달라진 source/test는 아래5개다.

1. packages/detection/src/adult-solicitation.ts
2. packages/detection/test/adult-context.test.ts
3. packages/contracts/src/case.ts
4. packages/contracts/test/case.test.ts
5. src-tauri/src/case_store.rs (시험만 추가)

OCR11/result19/config13은 소스가 바뀌지 않았다. 새 5파일 Vitest 예상 합계는 **27+11+19+13+38=108**이다. 89 PASS를108 PASS로 바꿔 기록하지 않는다. guard-owner가 새 manifest identity를 고정하고 canonical guard를 통해서만 실행한다. 이 작업은 직접 admission/테스트를 실행하지 않았다. type/lint/build/실제 DOM/native 저장 왕복은 여전히 별도 검증 대기다.
