# 복구 후 보존 확인과 기존 OCR 실패 분석

이번 단계는 git/작은 로그/소스/proc/journal 읽기와 문서 기록만 수행했다. 테스트·빌드·embedding·archive·guard verify/admission 실행은 하지 않았다. 다른 사용자 서비스와 VM은 조작하지 않았다.

## 보존 확인

- HEAD: `ae12f7c766d8f1c7f882afb71cd93499b260729f`
- branch: `fix/adult-semantic-20261026`
- worktree: `<candidate-worktree>`
- 제품 tracked 변경은 `packages/detection/src/semantic.ts`만, 37 additions / 8 deletions.
- SHA256: `aaf417f72c0fc3ebb3ae140165613912d6074acb3e1abc9010eba13e617f4029` 일치.
- 기존 untracked: 검증 문서/첫 평가 실패 JSON, adult-semantics.test.ts, adult-evaluation.test.ts, fixtures/adult-evaluation의 README/cases.json/holdout.json. 모두 존재한다. 이 분석 문서만 추가했다.
- 호스트 권한의 read-only `/proc/3735430`, ps/cwd/starttime 조건부 조회: PID 자체가 없어 cwd/starttime도 조회 불가. PID 재사용 또는 이전 session 생존을 추정하지 않았다. kill/restart/예전 session 재개는 하지 않았다.
- `/tmp/krds-adult-image-retry.log`는 여전히 0 bytes. 재시도의 Vitest 시작/성공/실패/종료 결과를 입증하지 못한다. 이전 세션 번호를 새 작업에 재사용하지 않는다.

## 관측 사실

`/tmp/krds-adult-full-tests.log`: 354.89초, 819 PASS / 1 FAIL / 1 SKIP. 유일한 FAIL은 `packages/evidence/test/image-embedding.test.ts`, 52.596초 뒤 `OCR recognition failed`. 구체적인 실패 호출/원인 stack은 없다. 새 성인광고 관련 시험은 PASS다. 기존 OCR 시험 파일의 13개는 같은 전체 실행에서 PASS했다.

이 시험은 `../dist/ocr.js`의 LocalOcrBackend를 통해 warm → analyzeText → analyzeImage를 호출하며, 변경한 `detection/src/semantic.ts` 또는 공식 성인 gate를 호출하지 않는다. tracked evidence 소스 변경도 없다. 따라서 성인 범주 변경에 의한 직접 회귀라는 증거는 없다. 이는 baseline 비교 재실행 없이 모든 간접 영향까지 배제한다는 뜻은 아니다.

`packages/evidence/src/ocr.ts`의 run()에서 message 파싱/응답 검증 중 발생한 원래 예외를 catch한 후 failed()가 새 `OCR recognition failed`로 대체한다. worker error 이벤트와 IPC send 오류도 같은 문자열이다. warm-up, analyzeText 및 analyzeImage의 구체적인 오류가 구분되지 않는다. worker stdout/stderr는 resume()하여 버리므로 기존 로그에서 native 상세 원인을 복원할 수 없다. 이 시험은 recognize()를 호출하지 않아, 오류 문자열을 '이미지 OCR 인식 자체의 실패'로 읽는 것도 잘못이다.

명시적 deadline 경로는 `OCR budget exhausted`, 직접 exit 경로는 `OCR worker exited`라는 다른 문자열을 사용한다. 따라서 관측 오류만으로 timeout이나 OOM kill이라고 단정할 수 없다. spawn/IPC/native 응답 문제가 자원 압박으로 일어났을 가능성은 있으나 확정 증거가 없다.

실패를 포함하는 UTC 2026-10-25 15:28–15:40 구간에 대해 host `journalctl -k`에서 oom/Out of memory/Killed process/memory cgroup 패턴을 조회했으나 일치 출력은 없었다(rg exit 1). 이 조회 범위·현재 journal 접근에서 직접 OOM 근거를 찾지 못했다는 뜻이며, OOM 부재나 자원 정상의 증명은 아니다. 별도 recovery 보고서에 기록된 다른 시각의 OOM을 이 시험 실패의 원인으로 옮겨 붙이지 않는다.

**분류: 원인 미확정의 기존 OCR/embedding runtime 또는 IPC 실패. 성인 semantic 회귀는 입증되지 않았고, 환경/자원 기여도 미확정. 전체 suite 결과는 계속 FAIL로 유지하며 flaky/PASS로 재분류하지 않는다.**

## 현재 자원과 실행 보류

복구 후 두 snapshot의 MemAvailable은 7,535,820 / 9,244,476 KiB였다. 후자의 SwapFree 716 KiB, PSI some avg10=0.13%, full avg10=0.09%. 일반 guard 조건(available >=14GiB, swap free >=2GiB, some<1%, full=0) 중 memory/swap/full PSI가 충족되지 않는다. 실제 guard admission 명령을 실행하지 않았으며 exit75를 새 관측 결과로 주장하지 않는다.

모든 후속 build/test/embedding/archive는 `<validation-evidence>/krds-workload-guard.py`와 `GUARD-HANDOFF.md`의 공유 lock, aggregate2GiB/swap0 제한을 따라야 한다. 부모의 guard 독립검수 완료·일반작업 실행 승인과 실제 admission 통과 전에는 실행하지 않는다. 직접 실행·다른 scope·verify에 임의 argv를 넣는 우회는 금지한다.

다음 안전한 순서: 승인/자원 조건 확인 → guard를 통한 최종 type/lint/build 및 관련 시험 → OCR 실패의 단계/원래 응답을 구분하는 최소 임시 진단(필요 시 부모와 범위 확정) → 단독 재현 결과 비교. 별도 heavy 모델 warm-up/전체 suite 반복을 먼저 시작하지 않는다. 로컬 커밋/최종 완료는 아직 미완료다.
