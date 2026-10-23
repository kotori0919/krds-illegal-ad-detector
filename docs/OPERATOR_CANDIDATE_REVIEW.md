# 운영자 후보 검토: 일반 댓글과 반응형 메뉴

## 확인 범위

원본 617건의 정제된 JSON은 수정하지 않았다. 그 JSON의 `f372`에는
`원피스는 ㄹㅇ 재미가보장되있네 ㅋㅋㅋ`라는 원문, `JAMO` 분류와 위치만 있다.
원래 DOM, 계산된 스타일, 주변 링크, 화면 상태가 없으므로 해당 원본 사이트의
오탐을 확정하거나 그 화면을 재현했다고 주장할 수 없다.

대신 `packages/detection/test/operator-candidates.test.ts`에 직접 소유하는
작은 HTML 사이트를 만들고 실제 Chromium과 `scanSite` 전체 경로로 검사했다.
이 실행은 루프백 HTTP 서버를 사용하며 외부 사이트를 방문하지 않는다.
정규 크롤링, 라이브 페이지 분석, 공식 결과 생성과 상세 근거 생성을 거친다.
단순한 문자열 판정이나 DOM 없는 JSON 재평가는 아니다.

소유한 페이지에는 다음 조건을 함께 넣었다.

| 조건 | 기대하는 공식 결과 |
| --- | --- |
| 일반 댓글로 표시한 정확한 f372 원문 | 없음 |
| 실제 열기 버튼/`aria-controls`/`aria-expanded`가 있는 반응형 메뉴의 숨은 `바카라` 링크, 같은 텍스트/목적지의 보이는 데스크톱 링크 | 없음 |
| `display:none`으로 숨긴 `카지노 첫충 보너스 지급` 광고, 목적지 `/game/baccarat` | `OFFSCREEN` 한 건 |
| 숨은 `카지노 피해 신고 절차와 도움말` | 없음 |

메뉴는 넓은 화면에서 닫히고 같은 목적지의 데스크톱 링크가 보인다. 작은 화면의
버튼은 패널의 `hidden`과 `aria-expanded`를 변경한다. 숨은 메뉴라는 이유만으로
모든 숨은 광고를 제외해서는 안 된다. 같은 페이지의 실제 광고도 동일한
`/game/baccarat` 목적지를 사용하므로 목적지, 특정 사이트, CSS 클래스 또는
문구를 통째로 제외하는 우회로는 이 조건을 충족하지 못한다.

## 수정 전 관찰

**OBSERVED:** 2026-10-08 첫 실행에서 페이지 한 개가 성공적으로 검사되었고,
공식 결과는 기대한 광고 한 건 대신 다음 세 건이었다. `scanSite`의
`detailBundle.findings`에서 실제 근거를 읽었다. 임시 진단 출력은 테스트에서
제거했고 영구 테스트는 사용자에게 보이는 최종 탐지 결과를 확인한다.

| 소유한 요소 | 공식 분류 | 의미 근거 | 은닉/문자 근거 |
| --- | --- | --- | --- |
| `#ordinary-comment` | `JAMO` | `matchedTerms: ["보장"]` | `jamo fragmentation: 5 jamo chars → "원피스는ᄅᄋ재미가보장되있네ᄏᄏᄏ"` |
| `#collapsed-category` | `OFFSCREEN` | `matchedTerms: ["바카라"]`, 목적지 `/game/baccarat` | `zero-size box with text box=0,0,0x0` |
| `#hidden-offer` | `OFFSCREEN` | `matchedTerms: ["카지노", "보너스", "첫충"]`, 목적지 `/game/baccarat` | `display:none; zero-size box with text box=0,0,0x0` |

일반 댓글의 실제 계산된 값은 `display:block`, `opacity:1`, `fontSize:16px`이고
관찰된 상자는 `(8, 145.875, 1264, 24)`였다. 이 fixture의 댓글은 화면에 보였다.
숨은 메뉴 링크 자체는 `display:inline`, `opacity:1`이지만 숨은 조상 때문에
상자가 `(0, 0, 0, 0)`이었다. 실제 광고 링크는 `display:none`이고 같은 영 상자를
가졌다. 숨은 신고 도움말과 보이는 메뉴 링크는 공식 결과에 없었다.

**INFERRED:** 일반 댓글 사례에서는 일반적인 `보장` 단어와 독립 자음/웃음의
전체 개수가 결합해 광고 은닉으로 승격되었다. 메뉴 사례에서는 실제 접힘 상태와
보이는 동등한 탐색 경로를 구분하지 않은 영 상자 판정이 공식 결과로 승격되었다.
이는 위 소유 fixture에 대해 관찰된 동작을 설명한 것이며 원래 617건의 화면에
대한 추론을 관찰로 바꾸지 않는다.

## 재현과 검증

```sh
npx vitest run packages/detection/test/operator-candidates.test.ts --project packages
```

영구 회귀 조건은 성공한 페이지 한 개, 시간 초과/실패 없음, 공식 JSON과 상세
근거의 계약 유효성, 실제 숨은 광고 한 건 보존이다. 나머지 세 부류가 공식
결과에 들어가면 실패한다. ID 순서, 진단 문구, 클래스 이름 또는 구현 연결을
고정하지 않는다. **OBSERVED:** 수정 전 같은 명령은 두 추가 후보 때문에
실패했고 수정 후 실제 `scanSite` 실행은 숨은 광고 한 건만 남겨 통과했다.

## 일반 규칙 수정과 회귀 범위

`semantic.ts`는 기존 단어 목록을 유지하면서 `보장`, `당일`, `고액`, `보너스`,
`쿠폰`, `무료체험`만 있는 문장을 광고로 확정하지 않는다. 강한 범주, 구체적
제안 또는 광고 목적지가 뒷받침해야 한다. 무료체험 후기와 신청/제공 제안은
서로 구분한다. 공개 신고/교육 문구에 대한 기존 보호와 그 안에 숨긴 실제
가입/지급 제안을 탐지하는 규칙도 유지한다.

`jamo.ts`는 웃음/독립 자음의 전체 개수 대신 모음이 포함된 자모가 광고 단어의
재구성에 실제 기여했는지 확인한다. 자모 제거 전후 정규화된 단어 출현 횟수를
비교한다. 같은 요소에 일반 `카지노`와 분해한 `ㅋㅏㅈㅣㄴㅗ`가 함께 있어도
두 번째 표기의 기여가 사라지지 않는다. 호환 자모, 결합 자모, 혼합 음절/자모,
띄어 쓴 분해 표기의 양성 조건을 직접 검증한다. 원문은 계속 그대로 보존한다.

`visibility.ts`는 계산된 은닉 신호를 재사용해 보이는 동등 링크를 판정하고,
활성 인터랙티브 컨트롤의 `aria-controls`가 실제 숨은 패널을 가리키는지
확인한다. `pipeline.ts`는 이러한 탐색 UI 근거가 있고 제안/광고 목적지 근거가
없을 때만 `OFFSCREEN` 승격을 제외한다. 다른 공식 기법을 제외하지 않는다.

두 번째 실제 `scanSite` fixture는 다음 경계도 확인한다.

- 제어 관계만 있는 접힌 범주와 동등한 보이는 링크만 있는 탐색 범주는 제외.
- `<nav>`만 있거나 탐색 바깥에 있는 숨은 광고 범주는 계속 탐지.
- 정상 메뉴처럼 만든 광고도 제안 문구 또는 가입 목적지가 있으면 계속 탐지.
- 일반 요소에 붙인 가짜 컨트롤, 비활성 컨트롤, 다른 실제 요소를 가리키는 중복
  ID 관계는 제외 근거로 인정하지 않음.
- 텍스트/목적지가 다른 링크와 투명한 링크는 보이는 동등 경로로 인정하지 않음.

관련 순수 규칙 테스트는 `operator-rules.test.ts`의 26개 조건이다. 기존 양성/
음성/공격적 표기/텍스트 소유권/공공 안내 사이트 테스트를 함께 실행해 네 가지
공식 기법과 1–4 worker의 공공 안내 음성 결과도 확인했다.

```sh
npx vitest run packages/detection/test/operator-candidates.test.ts packages/detection/test/operator-rules.test.ts packages/detection/test/detection.test.ts packages/detection/test/adversarial.test.ts packages/detection/test/general-text.test.ts packages/detection/test/false-positive-site.test.ts --project packages
```

**OBSERVED:** 위 범위의 6개 테스트 파일, 48개 테스트가 통과했다. 전체 프로젝트
테스트나 Windows 검증 결과로 확대하지 않는다. 원본 617건 fixture와 공식 결과
계약은 변경하지 않았다. 엔진의 신규 결과에서 관찰된 일반 결함을 바로잡았다.
