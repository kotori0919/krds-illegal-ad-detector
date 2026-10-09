# 도입 구현 원장

기준: `d14b8feadf60a174d3d74ad47e49ba13072c84c7`, `dev/bootstrap`, Draft PR #2.
2026-10-09 시작 시 작업 트리 깨끗함, 원격 fetch 후 동일 HEAD, 다른 worktree 없음.
첨부 감사의 소스 복사 대신 현재 실행 경계를 검증한다. 과거 RC는 보존한다.

| 항목 | 상태 | 소유 경계 | 구현 커밋 | 최소 검증 / 남은 불확실성 |
| --- | --- | --- | --- | --- |
| M0 | IN_PROGRESS | KODEX/GOAL/계약 | 이 원장과 동행 | 공식/내부 계약 분리; 초기 상태 확인 |
| A01/A02 | CONFIRMED | pure text / pipeline | 진행 중 | 현재 함수에서 대문자·키릴·종성 누락, 도서관·인용 통과 관측; 자연어 f372 음성 유지 |
| A03/A04 | IN_PROGRESS | visibility / scanner / selector | 진행 중 | 실제 Chromium 렌더링·프레임 역해결 |
| A05/A10 | IN_PROGRESS | native CaseStore / HostBridge / review | 진행 중 | 공식 독립 저장·재시작·검토 충돌·전달 |
| A06 | CONFIRMED | browser launch | 진행 중 | 기존 no-sandbox 정적 확인; 이 Linux 호스트 sandbox 실행 실패 관측; Windows 별도 검증 필요 |
| A07/A08/A09 | IN_PROGRESS | scan / asset / graph collection | 진행 중 | 순서 독립 선택·공유 바이트·수집 상한·프로세스 트리 측정 |
| A11 | IN_PROGRESS | evidence graph / inspector | 진행 중 | 동일 원본 선택·키보드·목록 대안 |
| A12 | IN_PROGRESS | independent fixture evaluation | 진행 중 | 감사 회귀와 분리한 template/site/creative holdout |
| A13/M4 | IN_PROGRESS | scripts / CI / deployment | 진행 중 | clean source·resource provenance·Windows changed-boundary |
| A14 | IN_PROGRESS | access/retry/deadline | 진행 중 | 120초 Retry-After 보존·취소 |

공통 계약 소유자는 통합 담당이다. selector 계약만 scanner 담당에 위임했다.
공식 contract v0는 그대로, 내부 case schema 1과 policy 2는 별도 식별한다.
목표 후보 버전은 0.2.0이며 과거 0.1.0 후보 파일은 변경하지 않는다.

## 검증과 인수 기준

- OBSERVED: 위 표의 현재 실행 관측. 정적 경로는 실행 관측과 구분한다.
- 필수: 공식 JSON strict validation, 원문·원본 불변, 선택 기능 장애 격리,
  저장→종료→재열기→검토→보고, 동일 src 및 blank frame 역해결,
  공개망·deadline·취소 회귀, clean source build와 candidate manifest.
- NOT_RUN: 현재 후보 Windows 설치/업그레이드/롤백, 실제 사람·보조기술
  과업 및 외부 평가. 실행 전에는 성공으로 기록하지 않는다.
