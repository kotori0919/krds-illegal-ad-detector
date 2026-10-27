# PR 준비 정리 검증 — 2026-10-27

기준 HEAD `789a60ef1a4a5544df9bb481ab93ece88f9356ef`, branch `fix/adult-semantic-20261026`. 정확한 후속 commit은 이 문서가 포함된 PR commit 목록으로 식별한다. 원본·main·제출 tag/ZIP·다른 담당 변경을 보존하며 push/PR은 이 단계에서 실행하지 않는다.

## 변경

- desktop build-manifest의 잘못된 policy2 상수를 공통 `packages/contracts/src/policy.json`에 연결했다. 독립적인 Case schema1, 공식 결과 형식, text-policy-2, 과거 Case 읽기는 변경하지 않는다. 실제 helper 값과 desktop의 연결을 확인하는 작은 시험2개를 추가했다. 연결 시험은 무거운 desktop 빌드 대신 소스 wiring을 검사한다.
- CI verify 단계에 해당2개와 기존 pinned I/O11개를 직렬 등록했다. CI 자체의 원격 실행은 아직 하지 않았다.
- README·사용/빌드·데이터 처리 문서에서 제출본과 정책3 후보, 로컬 추론과 URL 인터넷 접속, 모델 준비와 최신 미완료 범위를 구분했다. `build:scanner`를 `check` 앞에 배치했다.
- 데이터 출처 인덱스는 authored/실제/파생 자료·모델 revision/SHA/고지·권리 미확인을 구분한다. 데이터 원본·gold·threshold·가중치·프로젝트 라이선스를 변경하지 않는다.
- 서술 문서25개의 사용자 홈/사용자명/외부 볼륨 경로를 공유용 역할/증거 식별자로 바꿨다. 원시 역사 증거·identity·제출 문서24파일은 바이트 비교로 불변을 확인했다. 그 안의 당시 경로는 현재 설치 지침이 아니다.

## 이번 실행

[고정 소스·명령·자원 요약](pr-cleanup-evidence/SUMMARY.json), [13개 TAP](pr-cleanup-evidence/node-tests.tap).

공유 lock과 기존 bounded 보호를 사용했다. 개별 High768MiB/Max1GiB/swap0, aggregate High1536MiB/Max2GiB/swap0, 단일 scope에서 두 작업을 순차 실행했다. RAM 입장5GiB/실행4GiB, PSI·실제 swap 추세 중단 및 유한 timeout을 유지했다. 일반 test gate를 변경하지 않았다. 큰 모델 읽기·worker·build·네트워크 작업은 없다.

```sh
node --max-old-space-size=64 --test --test-concurrency=1 --test-reporter=tap scripts/test/build-policy.test.mjs scripts/test/pinned-asset-io.test.mjs
node --max-old-space-size=128 node_modules/eslint/bin/eslint.js --no-cache --no-fix scripts/desktop.mjs scripts/lib/build-policy.mjs scripts/test/build-policy.test.mjs
```

이는 guard가 고정 argv로 실행한 내용이며 공유 호스트에서 직접 실행하는 예외가 아니다. 실제 실행 도구/manifest/runner/로그의 전체 해시는 요약과 외부 증거 식별자 `krds-pr-cleanup-final-01`에 남겼다.

| 항목 | 상태 | 범위 |
| --- | --- | --- |
| Node 작은 회귀 | PASS | 최종 소스13/13, FAIL0/SKIP0 |
| 변경 JavaScript ESLint | PASS | 최종3파일, error0/warning0 |
| 첫 lint 시도 | FAIL 후 수정 | 새 시험의 URL 명시 import 누락1건. 기대값/규칙 완화 없이 import 후 위 시험/lint 재실행 |
| 자원 | PASS | 최종 scope peak 약154.2MiB, pids peak16, swap0, 새 memory high/max/OOM 및 pids max 이벤트0. aggregate 누적 과거 event/peak는 현재 실행과 구분 |
| 정적 문서/diff | PASS | 신규 안내의 상대 링크·추가 파일 크기·차이 검토, 보호된 역사24파일 불변 |
| 최신 전체 suite/type/build/native/실모델/Windows E2E | NOT_RUN | 이번 최소 정리에서 실행하지 않음. 기존 source별 관측은 [현재 후보 상태](../CANDIDATE_STATUS_KO.md)에 구분 |

Windows 모델 복사 압박과 Tasks96의 C4 제약, 실제 설치·GUI/IPC·실사이트/Excel 시험, 최소 사양 측정, 외부 데이터 재배포 허락 확인은 남아 있다. 이번 회귀로 해결됐다고 주장하지 않는다.
