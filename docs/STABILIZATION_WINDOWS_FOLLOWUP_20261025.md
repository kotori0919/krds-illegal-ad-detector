# 독립 검수 반영과 기존 Windows VM 사전점검 — 2026-10-25

## 완료한 문서 정정과 검수 보존

부모의 두 번째 독립 검수 결과는 [원문](STABILIZATION_SECOND_PASS_REVIEW_20261025.md)에
보존했다. 국소 코드 수정은 승인 가능/PR검토 후보이며 Windows-ready·전체완료는 보류다.
그 검수의 Low 지적에 따라 ACCESS_LIMITATIONS.md의 Retry-After 안내를 **HTTP429 응답의
유효한 헤더**로 한정했다. 현재 access.ts와 sitemap.ts가 이 조건에서만 대기값을
반영하며503 등 모든 응답에 공통 적용하는 정책은 아니다. 제품 동작은 변경하지 않았다.

검수 원문과 source-verification/final-status/full-holdout/integration/focused/
archived-banners 로그는 artifacts/stabilization-followup-20261025/independent-review에
바이트 그대로 복사했다. 원본 `/tmp/krds-pass2-review-3m5xil0e`는 변경하지 않았다.
검수의798PASS·보관픽셀8/8·합성메모리 개선은 독립 검수의 관측이며 이번 문서-only
패스에서 제품 전체 시험을 새로 반복했다는 뜻이 아니다. 공개web 모집단 정확도나
Windows 총메모리 성능·전체제품 수용으로 확대하지 않는다.

## 기존 clean11의 용도·구성·사용 여부

이번 지시는 기존 테스트VM의 비파괴 실행을 허용한다. 과거의 입력 소유권 질문만으로
자동 중단하지 않고 실제 상태를 점검했다. 기존 정의만 읽었고 VM/보안/네트워크/credential
설정을 바꾸거나 새 이미지/VM/OS를 만들지 않았다.

- 기존 session libvirt domain: clean11, UUID230b30eb-4c88-42e0-8f52-15d7c7e182e1.
- docs/DRY_RUN.md의 기존 KRDS Windows11 검증VM과 같은 이름/경로다.
- 기존 설정: KVM/q35/UEFI,4vCPU/8GiB, e1000e user network, loopback VNC autoport.
- `virsh -c qemu:///session dominfo clean11`: exit0, persistent/shut off, managed save 없음.
- domstate: exit0, shut off (unknown). list --all: exit0, 실행 중 domain 없음.
- 초기 `pgrep`에서 QEMU 실행 매치 없음(exit1은 '매치 없음'이며 오류나 강제종료 아님).
- 호스트 사전관측: RAM약30GiB, available약9.8GiB, swap약14.9GiB 거의 사용 중;
  memory pressure avg10/60/300=0.00. vmstat의 두 추가샘플은si/so0, CPU idle98%였다.
  workspace 볼륨 여유약98GiB. 다른 workload를 종료하지 않았다.

구성 XML SHA256:
`75e368407cec6ec8638014c24e17f61eaec1e9ab0eeb1d89e5c73f162a79c587`.
XML 사본과 리소스·미디어 상태는 artifacts/stabilization-followup-20261025에 보존했다.

## 명확한 blocker와 중단 경계

`domblklist --details`가 지정한 아래3개 기존 파일이 기본 샌드박스와 **호스트 양쪽에서
모두 FileNotFoundError/ENOENT**다. 호스트 관측UTC2026-10-25T12:49:02.884118,
vm-media-host.log/receipt/source manifest에 기록했다.

| 장치 | 기존 설정 경로 | 상태 |
| --- | --- | --- |
| sdb, 주 disk qcow2 | /home/monad/clean-vm/clean11.qcow2 | 없음 |
| sda, 설치 CDROM | /home/monad/clean-vm/win11-install.iso | 없음 |
| sdc, 기존 probe CDROM | /tmp/illegal-ad-toolchain/product-v2-coverage-core-probe.iso | 없음 |

**차단된 다음 동작은 기존 clean11의 시작 및 그 안의 Windows 검증**이다. 주 디스크가
없어 '기존 설정 그대로·기존 테스트경로 확인 후'라는 실행 전제가 충족되지 않는다.
`virsh start clean11`은 **NOT_RUN**, 권한 거절이나 결과불명 상태가 아니다. 부팅 가능성을
추정하거나 새 qcow2/ISO/설치로 대신하지 않았다. 기존 디스크 위치를 바꾸거나 누락ISO를
detach하는 설정 변경도 하지 않았다. 현재의 최소 선행조건은 소유자가 기존 테스트
디스크와 필요한 기존 media를 복구/확인하는 것이다. 이번 범위에서 파일을 새로 만들거나
다른 프로젝트/볼륨을 광범위하게 탐색해 대체본을 찾지 않는다.

| 이번 실행/게이트 | 결과 |
| --- | --- |
| VM정보/장치/상태/목록 읽기 | PASS exit0 |
| 기존3media 존재 조건 검사 | FAIL exit2,3개ENOENT; 제품 시험 실패가 아님 |
| VM 시작·Windows 부팅 | NOT_RUN, 주disk 및media 부재 |
| 이번소스 Windows 후보 빌드·설치 | NOT_RUN, 실행할Windows 경로 차단; 옛후보를 새후보로 부르지 않음 |
| 실제IPC/cache/cancel/restart/close | NOT_RUN |
| synthetic 양성2건 D08재시작/실제Excel | NOT_RUN; Excel 존재 여부도 미확인, 설치/계정생성 안함 |
| 업데이트/제거/잔류process | NOT_RUN; 기존설치·사용자데이터 제거 안함 |
| 문서diff 및code/fixture identity 불변 | PASS, 아래귀속 참조 |

## 소스 귀속과 재개 절차

기준최종HEAD bc1e92a925cf31ab79f29e3400e84bdbad5c71d0,
검증제품코드7395be2452a3a6a9b2da0f18361378682596923c다.
코드·fixture403파일 manifest의 종합SHA는 계속
`77a9fe529b5ab770c9db848ea9587ba5fb9ced94a6dd5d25c27293a543ea0893`다.
이번 차이는 docs/*.md뿐이며 code/fixture는 바꾸지 않는다. 각 read-only probe와
문서검사는 verify.py가 commit/tree/status/명령/환경/UTC/exit/logSHA 및 실행전후
동일성으로 묶었다. 최종문서커밋 이후 FINAL_IDENTITY.json과 EVIDENCE_INDEX.json에
귀속·문서-only diff·증거해시를 남긴다. 실행하지 않은제품시험을 새HEAD 통과로 쓰지 않는다.

기존미디어를 복구한 뒤 부모가 허용한 범위에서 다음을 순서대로 수행한다.

```sh
virsh -c qemu:///session dominfo clean11
virsh -c qemu:///session domblklist clean11 --details
# 먼저 모든 기존 source 파일의 존재/소유권과 자원·다른사용 여부를 다시 확인한다.
# 이 조건과 기존 테스트 목적이 확인된 후에만:
virsh -c qemu:///session start clean11
```

부팅후현재source의후보 식별/무결성 → 기존case보존 → 테스트VM설치 → 실제IPC와
이미지재조회/취소/재실행 → 소유synthetic 양성2case D08재시작/통합XLSX →
실제Excel(있을때만) → 동일후보업데이트·제거후보존·PID+생성시각잔류검증을 분리한다.
synthetic두양성은 공개양성두대상의 수용을 대신하지 않으며 기존공개D08는 여전히미완료다.

현재 전용branch/worktree를 유지하고 main/원본/기존다른worktree는 변경하지 않았다.
push/PR 승인대기·Google Tasks 완료금지를 지켰다. 알려진문서Low를 정정했고 Windows
경로의 명확한blocker를 식별했으므로 이번후속은 여기서 종료하여 부모에게 반환한다.
