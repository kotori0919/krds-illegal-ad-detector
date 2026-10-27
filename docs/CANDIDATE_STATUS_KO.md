# 정책3 후보: 실행·검증 안내

이 문서는 `789a60ef1a4a5544df9bb481ab93ece88f9356ef`를 기준으로 정리한 후속 후보를 설명한다. 정리 변경은 PR의 commit 목록으로 식별한다. 10월23일 제출 tag/ZIP은 그대로 보존하며 이 후보가 기존 설치본이나 심사 자료에 반영됐다는 뜻은 아니다. 현재 후보의 새 설치본·최소 RAM/CPU/디스크 사양은 검증 완료되지 않았다.

## 심사자 실행 순서

1. 보존된 제출 설치본은 [제출 파일 식별](SUBMISSION_20261023/EVIDENCE_INDEX.md)의 파일명·SHA로 구별한다. 현재 후보를 설치하려면 새 후보의 installer SHA, build ID, source SHA, Windows target, 서명 상태와 실행 검증 기록이 먼저 필요하다. 아직 이 후보의 exe/NSIS/실제 Windows E2E 완료 기록은 없다.
2. 대상 환경은 Windows 11 x64와 WebView2다. 설치본은 Node·브라우저·OCR/EmbeddingGemma 모델을 포함하도록 구성된다. WebView2가 없으면 승인된 온라인 bootstrapper가 필요하며 완전 오프라인 설치는 미검증이다. 개발 소스로 준비하는 절차는 아래를 따른다.
3. 앱의 새 점검에 공개 `http://` 또는 `https://` URL을 입력한다. 기본 연결은 PC 네트워크이며, WARP는 명시적 동의·등록 후 선택하는 고급 연결이다. 자동 전환하지 않는다. 내부/사설 주소 제한을 해제하지 않는다.
4. 확인 페이지·실패·부분검사와 분석 오류를 확인한 뒤 원문·기법·요소 위치·이미지 근거를 검토한다. 공식4기법과 이미지/의미 비교의 추가 단서는 구분한다. 0건은 전체 수집이나 위반 부재의 증명이 아니다. 오류·시간/수집 상한에 닿은 결과를 완전한 음성으로 읽지 않는다.
5. 판단·메모를 저장하고 공식 JSON 및 XLSX를 내보낸다. 원본 `result.json`, 추가 단서 `result_extra.json`, 검토 `review.json`은 구분된다. 저장된 사례 검토·내보내기는 오프라인 가능하다. URL 탐색·이미지 수집에는 대상 사이트 접속이 필요하며 추론은 로컬 CPU에서 실행한다. 점검 중 외부 AI 호출·모델 다운로드는 없다.

자세한 화면 절차는 [사용자 매뉴얼](USER_MANUAL.md), 보관·공유 범위는 [데이터 처리](DATA_HANDLING_KO.md)를 따른다.

## 개발자 재현

저장소 루트에서 Node 22.19.0 기준:

```sh
npm ci
npx playwright-core install chromium --only-shell
npm run build:scanner
npm run check
node --test --test-concurrency=1 scripts/test/build-policy.test.mjs scripts/test/pinned-asset-io.test.mjs
npm run build
npm run dev
```

`build:scanner`를 먼저 실행해야 evidence/dist와 OCR worker 등 시험 입력이 준비된다. npm·브라우저·고정 모델의 최초 준비는 인터넷 또는 사전 준비 캐시가 필요하다. 캐시의 전체 크기/SHA 검사는 유지한다. `dev`는 웹 미리보기로 네이티브 스캔 증거가 아니다. Windows Rust/런타임/패키징은 [빌드 매뉴얼](BUILD_MANUAL.md)을 따른다. 이 공유 작업 호스트에서 실행할 때는 별도 workload guard의 입장·공유 lock·메모리/PSI 경계를 따라야 하며 위 명령은 무가드 실행 허가가 아니다. CI의 Linux fixture sandbox adapter와 실제 외부 URL 검사의 보안 경계도 구별한다.

## 검증 기록의 범위

| 소스/시험 | 관측 | 해석 |
| --- | --- | --- |
| r2 고정 source manifest | mock/순수 108 PASS, noEmit projection 6프로젝트, lint 265파일 PASS | [r2 원시 증거](validation/r2-evidence/STATIC-R2-VALIDATION-REPORT.md), [type/lint](validation/r2-evidence/STATIC-R2-FINAL-CHECKS-REPORT.md). 해당 해시에만 귀속 |
| HEAD `30eb4eb` 전체 회귀 | 868 PASS / 2 FAIL | sidecar import fixture 결손. 최신 후보 전체 PASS가 아님 |
| `76564e3` sidecar fixture 수정 | 관련 두 파일 16/16 PASS | 별도 실행이며 위 전체 결과와 합산하지 않음 |
| authored 성인 DOM holdout | TP6/FP0/FN0 | [corpus 설명](../packages/detection/test/fixtures/adult-evaluation/README.md). 자체작성 소규모, 실제 정확도/외부 benchmark 아님 |
| false-positive-site fixture | 각 C1~4에서 10 pages/53 owners/issues0 | fixture 수집 완전성. Tasks96의 C4 limit event +1 자원 FAIL은 미해결 |
| `789a60ef` pinned I/O | 11 PASS | 작은 synthetic 파일만. 전체 SHA·동일 inode·EXDEV·rename 실패 보존/정리 검증 |
| `f457731` Linux OCR worker 빌드 / `789a60ef` frontend | 담당 실행 PASS 기록 | 최신 Windows 패키징/전체 suite 통과와 다름 |
| Windows native38 | windows 0.62.2 컴파일 뒤 Tauri 모델 복사 PSI 보호 중단 | 전체 native 성공 아님. exe/NSIS/Windows GUI·IPC·URL·취소/재시작·Excel·설치/업데이트/제거 NOT_RUN |

이번 정리의 작은 회귀 결과는 [PR 정리 검증 기록](validation/PR_CLEANUP_KO.md)에 별도로 기록한다. 기존 대형 시험 결과를 새 소스의 전체 합격으로 표기하지 않는다. 제품 기본 동시성은2, 허용1~4이며 자원 관측을 제품 최소 사양으로 간주하지 않는다. 한국어의 유한 범주/CTA·부정/교육 문맥을 다루며 국제어·복잡한 반어·법적 위반 전반을 지원한다고 주장하지 않는다.

## 역사 증거 읽기

문서의 `<repository>`, `<candidate-worktree>`, `<stabilization-worktree>`, `<local-evidence>`, `<external-evidence>`, `<validation-evidence>`, `<workspace-instructions>`는 공유용 역할/증거 식별자다. 실제 존재하는 상대 경로나 자동 다운로드 위치가 아니다. `/tmp/…` 역사 경로도 파일이 현재 배포됐다는 뜻이 아니다. 해시에 결속된 `validation/historical-evidence/`, `validation/r2-evidence/`, identity JSON 및 그 참조 문서는 원시 바이트를 보존했다. 그 안의 당시 로컬 경로는 현재 설치 지침이 아니다. 10월23일 제출 문서도 원본 그대로다.
