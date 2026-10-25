# OCR 진단 보존 국소 변경 — 구현만, 실행 대기

현재 상태: **getter 수정본 EDITED / NOT_RUN**. 부모가 검증한 이전 OCR 8개 PASS는 이전 파일 해시에만 귀속하며, 이번 변경 후 11개는 재검증 대기다. 기존 819 PASS / 1 FAIL / 1 SKIP은 이 변경 전 결과다. 새 코드 PASS 또는 image-embedding 실패 수정 완료를 주장하지 않는다. 실제 native 원인은 여전히 미확정이다.

## 별도 변경 단위

성인광고 semantic 수정 파일과 분리했다. 이 단위만 선택할 때의 파일:

1. `packages/evidence/src/ocr.ts`: 공개 메서드 인자/반환형과 기존 reject message를 유지한다. private queue에 operation 식별자를 전달한다. 기존에 버리던 응답 검증/IPC/worker error 예외는 기존 공개 메시지 Error의 표준 비열거 `cause`에 원래 객체로 연결한다. spawn/동기 send는 원래 예외 자체를 그대로 reject하고 로그만 추가한다. 기존 cleanup/timeout/worker 종료 방식과 모델 판정은 바꾸지 않는다.
2. `packages/evidence/src/ocr-diagnostics.ts`: root barrel에 export하지 않는 내부 helper. 실패당 `KRDSOCRDIAGNOSTIC` JSON 한 줄을 로컬 stderr에 기록한다. operation/phase/허용된 error name·errno/exit code·signal만 기록하며 raw message/stack/cause/worker output/payload/이미지/URL/파일경로/토큰을 직렬화하지 않는다. 알 수 없는 name/code/signal은 OTHER다. 진단 출력 실패나 예외 속성 getter 오류가 본래 오류를 대체하지 않게 한다.
3. `packages/evidence/test/ocr-diagnostics.test.ts`: fake IPC worker만 사용하는 작은 source-level 회귀. 브라우저/native/model/실제 child를 시작하지 않는다.
4. 이 문서.

예정 커밋은 성인광고 파일을 포함하지 않는 `fix: retain bounded OCR failure diagnostics` 단위다. 아직 commit/stage하지 않았다. 성인광고/기존 증거 파일을 amend하거나 함께 stage하지 않는다.

## 안전 경계와 남은 한계

`cause`는 원래 예외 객체이므로 외부 입력을 포함할 수 있다. 이를 의도적으로 로컬 로그에 출력하지 않으며 UI/사용자 메시지에도 전달하지 않는다. 향후 소비자도 `cause`/stack 전체를 그대로 로그에 쓰지 말아야 한다. 로컬 로그에는 작업·실패 단계와 안전한 분류만 남는다. worker stderr를 무차별 forwarding하거나 추가 파일에 저장하지 않는다.

이 변경은 host가 받은 예외만 보존한다. 기존 worker가 catch 후 generic error/model-error 응답으로 이미 버린 native 원인은 되살릴 수 없다. 응답 검증 실패 단계는 구별되지만 온전한 native stack을 얻는 구현은 아니다. queued/preflight invalid-input 동작과 worker 프로토콜은 유지한다. 동기 send throw 뒤 기존 timer/listener cleanup 한계도 이번 진단 범위에서 고치지 않았다.

## 예정 검증 (아직 실행하지 않음)

부모의 guard 독립검수 완료/허용 profile 실행 승인 및 해당 admission 통과 뒤에만 수행한다. 모든 실행은 `/home/monad/Documents/Codex/2026-10-26/task-2/krds-workload-guard.py`와 최신 GUARD-HANDOFF.md를 따른다. 직접 실행/다른 scope/verify에 임의 argv를 넣는 우회는 금지한다. 새 경량 profile 명칭/한도는 아직 승인받지 않았으므로 이 문서는 명령을 임의로 정하지 않는다.

- 작은 회귀 8건: response-validation cause 보존/기존 public 메시지/민감 payload 미출력, ipc-send와 worker-error의 원래 cause identity 및 ENOMEM 분류, spawn 원래 reject와 worker exit 상태, logger 비밀문자열/임의 errno 필터·쓰기실패·속성 getter 안전성, recognize/analyze-image 각각의 legacy 메시지와 내부 validation cause 보존, deadline 메시지/단계 보존.
- evidence TypeScript check 및 대상 lint. 모듈 import/Node Error.cause/overloaded stderr spy 타입도 실제 check로 확인해야 한다.
- 허용된 build profile로 evidence 산출물 갱신 후 기존 OCR 계약 시험. 아직 dist는 의도적으로 재생성하지 않았으므로 기존 dist 기반 시험은 새 source의 증거가 될 수 없다.
- 모델/embedding 재현은 별도 heavy admission과 부모 승인 뒤 실행하며, 이번 helper 시험 통과가 이전 native failure 해결이라는 의미는 아니다.
- 새로운 실패 시 stderr의 operation/phase/causeCode와 공개 오류 .message를 함께 수집하되 cause/stack을 자동으로 덤프하지 않는다. safe code가 OTHER이거나 로그 단계만으로 원인 미확정이면 그대로 미확정으로 보고한다.

현재 gate는 실행 보류다. 문법·타입·lint·회귀 결과 모두 NOT_RUN이며 읽기 검토만 수행했다.
