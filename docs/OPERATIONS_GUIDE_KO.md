# 운영·배포 인계

공식 원본 기본 경로는 `%APPDATA%\kr.go.nia.illegal-ad-detector\cases\<case-id>\result.json`이다. 별도 Save As 원본/보고서/사례 내보내기는 운영자가 선택한 경로다. 앱이 보여 주는 실제 저장 경로가 우선이다. 프로그램 폴더를 데이터 저장소로 사용하지 않는다. 후보 build ID는 설치 `binaries/build-manifest.json`, 전달 설치본 해시는 같은 후보 `manifest.json`으로 확인한다.

## 배포 전 확인

운영자는 개발 도구 없이 NSIS 전체 설치본을 사용한다. 관리자는 정확한 후보 installer/manifest를 승인된 경로로 전달하고 해시를 확인한다. 파일 해시 자체는 발행자 인증이 아니며 현재 후보는 서명 없는 내부 평가용이다. 인증서 발급/서명/공개 배포는 별도 조직 승인 사항이다. WebView2가 이미 있어야 하거나 승인된 bootstrapper 네트워크가 필요하다. 완전 오프라인 설치가 검증됐다고 간주하지 않는다.

지원 진단은 사이트를 방문하지 않는다.

```powershell
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action diagnose
```

결과는 실제 데이터 경로, 실행 중 앱 또는 정확한 HKCU/HKLM NSIS 등록에서 찾은 설치 build ID, WebView2 등록·파일 근거를 출력한다. 등록됨/파일 존재는 런타임 실행 성공과 구분한다. 사용자 이름을 포함한 경로는 진단을 외부 전달하기 전에 검토/삭제한다. 인증정보나 원문 사례는 진단에 담지 않는다. 개발팀의 `npm run doctor`는 추가로 내장 resource와 도구 버전을 점검한다.

## 설치·업그레이드·실패 복구

앱을 닫기 전에 진행 스캔의 저장/취소를 완료한다. 관리 스크립트는 실행 중 앱을 강제로 종료하지 않고 배포를 거부한다. 다음 명령은 **대화형** NSIS를 열고 종료코드를 확인한다. 특정 후보에서 실측하지 않은 무인 설치/제거 옵션은 제공하지 않는다.

```powershell
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action install -Manifest '<candidate>\manifest.json' -Installer '<candidate>\setup.exe'
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action upgrade -Manifest '<candidate>\manifest.json' -Installer '<candidate>\setup.exe' -BackupPath '<protected-backups>\before-upgrade'
```

`upgrade`와 `rollback`은 설치 전에 AppData를 새 백업 폴더로 복사하고 모든 파일 해시를 기록한다. 기존 백업은 덮어쓰지 않는다. 백업은 데이터 폴더와 명시·발견한 설치 폴더 밖이어야 하며 junction으로 이 경계를 우회할 수 없다. installer 해시/manifest/profile 검사가 실패하면 실행하지 않는다. 설치가 실패하거나 중단되면 백업이 남는다. 성공 exit만 업무 검증으로 인정하지 말고 앱 build ID, 기존 사례 재열기, 메모, 원본 해시를 확인한다. 설치 스크립트는 데이터 schema를 변환하지 않는다. 지원하지 않는 미래 schema는 명시적으로 거부한다.

## 백업과 원복

```powershell
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action backup -BackupPath '<protected-backups>\daily-20261009'
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action rollback -Manifest '<previous-candidate>\manifest.json' -Installer '<previous-candidate>\setup.exe' -BackupPath '<protected-backups>\before-rollback'
powershell -NoProfile -File scripts/managed-deployment.ps1 -Action restore -BackupPath '<protected-backups>\before-upgrade' -ConfirmRestore
```

원복은 이전 전체 설치본을 관리자가 선택하여 대화형 설치한다. 다운그레이드가 installer에서 거절되면 데이터 보존을 확인한 뒤 프로그램 제거/이전 버전 재설치로 진행하고 기록한다. 데이터 restore는 모든 해시/경로/symlink/추가 파일을 검사하고 같은 상위 볼륨 staging으로 복사한다. 기존 데이터는 `.before-restore-<id>` 형제 폴더에 보존하고 교체 실패 시 되돌린다. 전원 손실에 대한 무조건적 내구성은 보장하지 않는다. 원복 후 app이 미래 case schema를 지원하지 못하면 덮어쓰지 말고 새 버전으로 열거나 해당 버전에서 만든 백업을 복구한다.

## 제거, 보관, 공유

Windows 앱 제거에서 프로그램을 제거한 뒤 기존 Save As 내보내기와 AppData 사례가 남는지 해당 후보로 확인한다. 사용자 데이터 삭제는 사례의 명시 삭제 기능 또는 조직 승인을 받은 관리자가 앱 종료/백업 후 정확한 사례 폴더를 삭제하는 별도 작업이다. 자동 보존 기간이나 자동 삭제는 없다. 저장 용량/권한 오류는 원본을 보존하고 쓰기 가능한 경로를 선택해 복구한다.

사례 전달은 앱의 버전 지정 사례 내보내기/가져오기 경로를 사용한다. 임의 archive 해제/원문 HTML 실행/외부 URL 자동 열기는 하지 않는다. 빠진 자산은 미확인으로 처리하며 네트워크로 자동 보충하지 않는다. 원본 판정은 수정하지 않고 운영자 판단/메모를 별도로 기록한다.

## 후보별 실측과 외부 수용

관리자는 후보 식별자와 함께 fresh install, N→N+1 기존 사례/메모 보존, 실패/중단 복구, rollback/restore, 일반 제거 후 사용자 데이터 보존을 기록한다. Windows sandbox와 설치 실행, 실제 Excel 렌더링, 보조기기/사람 사용성은 해당 환경에서 실행했을 때만 OBSERVED다. GNU 실행 증거를 MSVC 증거로 옮기지 않는다. SmartScreen/백신/TLS/sandbox/조직 정책을 해제하지 않는다. 미실행 항목은 NOT_RUN으로 남기며 NIA 인증/채택/법적 위반 확정이라고 설명하지 않는다.
