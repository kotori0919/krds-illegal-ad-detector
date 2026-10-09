# 유지보수 가능한 탐지 확장

공식 기법은 `HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN`의 닫힌 집합이다. 새 추가 분석은 공식 JSON에 새 기법을 넣지 않고 `result_extra.json`의 `ETC` + `extra_finding`을 사용한다. 원문과 과거 결과는 수정하지 않는다.

실제로 사용하는 확장 경계는 `packages/evidence/src/contributions.ts`의 `ExtraDetectorContribution`이다. ID/정책 버전/추가 유형, 필요한 원문·의미 문맥, reason code, UTF-16 관측 범위, 텍스트/스팬 제한, fixture 경로와 동기 평가 함수를 명시한다. 입출력은 matched/excluded/unavailable로 나뉘며 unavailable는 부정 판정이 아니다. 네트워크/동적 코드/원격 rule pack을 실행하는 plugin 체계가 아니다.

기존 `ZERO_WIDTH_OBFUSCATION`을 이 경계로 옮겼다. 의미 판정은 detection caller가 소유하고 zero-width 문자만으로 광고를 확정하지 않는다. `buildExtraResult`가 실제 contribution을 실행하고 결과를 기존 extra serializer로 전달한다. 65,536 UTF-16 단위 초과는 `EXTRA_TEXT_LIMIT` issue이며 caller가 onIssue를 수집하거나 명시 실패로 처리한다. 원문 zero-width 위치는 직접 원문에서 얻는다. 점수는 확률이 아니다.

새 유지보수 extra는 다음 범위만 변경한다.

1. `contributions.ts`의 인터페이스를 구현하는 source와 소비자 의미/관측을 정한다.
2. `extra.ts`에서 지원 기여자를 명시적으로 구성한다. 새 관측이 필요할 때만 해당 adapter를 수정한다.
3. 기여자 fixture의 양성/음성/제한/실패를 검사한다. 필요하면 UI 이름/설명 사전을 추가한다.
4. 공식 serializer, native process supervisor, 공식 기법 enum은 수정하지 않는다. 새 extra 이름은 canonical extra type 목록과 TS/native conformance fixture에 명시하여 검증 경계를 함께 갱신한다. 이는 공식 기법 추가나 process supervisor 변경이 아니다.

`packages/evidence/test/demo-contribution.ts`는 무해한 `[DEMO]` 표식만 찾는 컴파일 가능한 작성 예다. `is_violation:false`이며 테스트 밖에서 등록하거나 production finding을 생성하지 않는다. 테스트는 실제 원문 span과 무표식 제외를 확인한다.

```sh
npx vitest run packages/evidence/test/contributions.test.ts packages/evidence/test/demo-contribution.test.ts
npx tsc --noEmit -p packages/evidence/tsconfig.check.json
```

`adapters.ts`는 유지보수 코드용 `VisualSource<Input, Output>`, `ReportExporter<Input>`, `SimilarityProvider<Input>` 계약을 제공한다. ID/버전/availability/limits와 자동 재시도를 하지 않는 failure policy를 명시한다. 결과는 `available` + 값 + degradation 또는 `unavailable` + typed issue다. 값이 빈 배열이거나 비교 결과가 유사하지 않은 경우는 분석 불가와 다르다. 등록소, 동적 plugin 실행이나 자동 backend 선택은 없다.

- 시각 입력은 detection의 `creative.ts`에 있는 `livePageVisualSource`가 구현하고 `scan.ts`가 실제 소비한다. 살아 있는 Page/Frame/응답, 공통 deadline과 AbortSignal은 호출자가 소유한다. 기존 bounded 수집을 사용하며 후보 없음은 정상 빈 결과, 예산/취소/닫힌 소스는 불가, 일부 촬영 누락은 `PARTIAL_CAPTURE`와 기존 상세 coverage다. 새 시각 입력은 이 구현과 명시적 소비자 구성, 실제 입력 fixture만 변경한다. OCR는 별도 `OcrCropRequest/OcrBackend` 경계에서 수행한다.
- 보고서는 공개 `@krds-detector/evidence/report`의 `operationalWorkbookExporter`를 통해 실제 XLSX를 생성한다. 기존 `createOperationalWorkbook`도 이 exporter를 사용한다. 범위 초과는 `REPORT_BOUNDS`, 생성 실패는 `REPORT_FAILED`, 일부 범위 기록 부재는 `PARTIAL_REPORT`이며 파일 안에도 알 수 없음/제한을 표시한다. 새 projection/exporter는 `report.ts` 또는 새 공개 browser-safe 모듈과 보고서 소비자만 변경한다. 공식 JSON과 사람의 메모는 입력 원본으로 보존한다.
- 현재 유사도는 `fingerprint.ts`의 `blockHashSimilarity`가 구현한 64비트 Hamming 거리다. `groupSimilarCreatives`가 실제 provider를 소비한다. 잘못된 해시나 provider 실패는 typed issue이며 issue 수집자가 없으면 명시 실패한다. `scan.ts`는 issue를 분석 제한으로 저장한다. 새 provider는 입력/거리 척도/임계값/비용을 함께 검증하고 명시적으로 구성해야 한다. 유사성은 동일성·소유권·공식 위반 판정이 아니다.

외부 모델은 꺼져 있다. `DisabledMultimodalFallback`은 `DISABLED` 분석 불가를 반환하며 `isAd:false` 정상 판정을 만들어내지 않는다. 임의 모델을 정상 스캔 중 다운로드하거나 원문을 외부로 보내지 않는다. 관계는 공개 `/graph` entrypoint를 사용하며 browser 코드는 Node를 포함한 root barrel 대신 필요한 공개 subpath만 사용한다.

```sh
KRDS_TEST_UNSANDBOXED=1 npx vitest run packages/evidence/test/adapters.test.ts packages/evidence/test/report.test.ts packages/detection/test/visual-scheduler.test.ts
```

위 Linux 명령의 sandbox 예외는 명시적인 로컬 테스트 전용이다. Windows 수용검사는 예외 없이 수행한다. 어댑터 테스트는 실제 Chromium SVG 촬영·빈 후보·예산/취소/닫힌 소스, XLSX 재읽기와 원문 보존, 해시 음성/입력 불가/실패를 구분한다. harmless 작성 예는 위 `demo-contribution.ts`를 사용하며 production 결과에 등록하지 않는다.
