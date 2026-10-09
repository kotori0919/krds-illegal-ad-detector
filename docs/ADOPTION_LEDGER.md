# 도입 구현 원장

기준: `d14b8feadf60a174d3d74ad47e49ba13072c84c7`, `dev/bootstrap`, Draft PR #2.
2026-10-09 시작 시 작업 트리 깨끗함, 원격 fetch 후 동일 HEAD, 다른 worktree 없음.
첨부 감사의 소스 복사 대신 현재 실행 경계를 검증한다. 과거 RC는 보존한다.

| 항목 | 상태 | 소유 경계 | 구현 커밋 | 최소 검증 / 남은 불확실성 |
| --- | --- | --- | --- | --- |
| M0 | OBSERVED | KODEX/GOAL/계약 | `f81f133` | 실제 checkout·원격·감사 재현 확인, 계약/정책 ADR |
| A01/A02 | OBSERVED | pure text / pipeline | M1–M4 통합 변경 | 대문자·전각·키릴·종성 복원 후 문맥 판정; 원문 UTF-16 범위, 도서관·인용 음성 및 숨은 판촉 양성; TS/Rust 공통 corpus |
| A03/A04 | OBSERVED | observation / frame-location | M1–M4 통합 변경 | 실제 Chromium alpha/배경/문자 range/clipping/프레임 조상, duplicate-src·상대·중첩·srcdoc·populated blank 역해결 |
| A05/A10 | OBSERVED_LOCAL | CaseStore / HostBridge / review | M1–M4 통합 변경 | 원본 독립 commit/reopen, CAS 검토·선택 장애·전달/충돌/복구/공유 자산; native 52 통과. 실제 설치본 UI 종료/재열기 별도 필요 |
| A06 | IMPLEMENTED_WINDOWS_PENDING | production launch / public-network | M1–M4 통합 변경 | sandbox 명시, 자동 우회 없음. Linux 환경은 production sandbox 실행 불가; fixture 전용 우회와 Windows 실제 경로를 구분 |
| A07 | OBSERVED | visual scheduler | M1–M4 통합 변경 | 동일 후보 early/ninth/final/reorder, 결정 이유·coverage; live bytes만 사용 |
| A08 | OBSERVED | asset index / CaseStore | M1–M4 통합 변경 | 1/200 finding 공유 바이트, 큰 실제 JPEG 2 finding 저장·재열기와 hash 검증 |
| A09 | MEASURED_BOUNDED_FIXTURES | collection / graph / accumulator | M1–M4 통합 변경 | 삽입 전 DOM/frame/resource/후보/graph 상한; C1–4 실제 process-tree 표본. 보편적 메모리 상한·p95 주장은 하지 않음 |
| A11 | OBSERVED_CONTROLLED_UI | graph / shared inspector | M1–M4 통합 변경 | 원본 우선·항목/연결 페이지 선택·목록 대안·같은 finding; Chromium 키보드 및 320px 확인 |
| A12 | OBSERVED_BOUNDED_HOLDOUT | independent evaluation | M1–M4 통합 변경 | 분리한 6 template의 4 기법 각 TP1/FP0/FN0, 정상 2 FP0, 위치 8/8. 합성 holdout이며 공개 웹 일반화 근거 아님 |
| A13/M4 | IMPLEMENTED_RECEIVING_PENDING | scripts / CI / deployment | M1–M4 통합 변경 | Node/Rust/runtime lock·hash·CI·managed backup/recovery 구현. 새 Windows source build/설치/upgrade/rollback 실증 전 |
| A14 | OBSERVED | access/retry/deadline | M1–M4 통합 변경 | Retry-After 120초를 5초로 축소하지 않음; 실제 취소/deadline 회귀 |

공통 계약 소유자는 통합 담당이다. selector 계약만 scanner 담당에 위임했다.
공식 contract v0는 그대로, 내부 case schema 1과 policy 2는 별도 식별한다.
목표 후보 버전은 0.2.0이며 과거 0.1.0 후보 파일은 변경하지 않는다.

## 검증과 인수 기준

- OBSERVED: 최종 통합 `KRDS_TEST_UNSANDBOXED=1 npm run check`는 타입/lint와
  487 테스트 통과, 기존 1 skip(80 파일, 65.76초). native harness 52 통과/2 필터,
  Windows GNU all-target Clippy `-D warnings`, fmt, build-boundary 3건 통과.
  두 native real-worker 필터는 이 Linux 호스트의 production sandbox 제약이며
  Windows 실행으로 별도 검증한다. 이전 통합의 네트워크 시간 초과 원인은
  INFERRED 상태다. 실제 Chromium disposal 지연 회귀는 종료 의존성을 수정하기
  전 실패/후 통과했고, 시간 제한·보안 정책을 늘리거나 우회하지 않았다.
  케이스 한 건의 잘못된 manifest가 보관 목록 전체를 막던 경계도 재현 후 격리했다.
  실제 built UI의 관계→원본→뒤로 초점 복원·필터 보존·검토 저장/재열기·XLSX
  생성·원본 불변을 file-backed 시험 IPC로 확인했으며 native 증거로 전용하지 않는다.
- 필수: 공식 JSON strict validation, 원문·원본 불변, 선택 기능 장애 격리,
  저장→종료→재열기→검토→보고, 동일 src 및 blank frame 역해결,
  공개망·deadline·취소 회귀, clean source build와 candidate manifest.
- NOT_RUN: 현재 후보 Windows 설치/업그레이드/롤백, 실제 사람·보조기술
  과업 및 외부 평가. 실행 전에는 성공으로 기록하지 않는다.
