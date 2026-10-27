# r2 좁은 재검수 — 정적 코드 승인

판정: **알려진 High/Medium 차단 항목은 r2에서 해소됐고 국소 제품 코드의 정적 승인이 가능하다.** 이번 재검수에서 새로운 blocking defect는 발견하지 못했다. 불가능한 유한문법 완전성을 승인조건으로 추가하지 않는다. 이는 실행시험/빌드/Windows/실모델 승인과는 구분한다.

## exact source identity

HEAD는ae12f7c766d8f1c7f882afb71cd93499b260729f,새commit없음.
보존r1manifestSHA=15fef6414593d7e4fe04761822cde794d763de70aa6cb68941b14a391d19786b.
r2manifestSHA=4125496324d80b8da50a5407510a67595e16cb25004b42490ec342a9981b7993.
r2.parentManifestSHA는보존r1과일치,canonicalmanifest는r2와같은바이트다.

r1→r2source/test변경은선언대로5개뿐이다:
- detection/src/adult-solicitation.ts
- detection/test/adult-context.test.ts
- contracts/src/case.ts
- contracts/test/case.test.ts
- src-tauri/src/case_store.rs (native시험추가뿐)

23개현재파일SHA모두manifest와일치했다. OCRdiagnostics11/result/config의제품소스는r1→r2불변이다. identity세부는R2_IDENTITY_CHECK.json.

## High 부정 CTA 해소 근거

adult-solicitation.ts:10,43-44는CTA뒤선택조사1개와명시된짧은강조부사최대2개를지나가까운부정을판별한다. 이전반례'성인방송 가입 절대 금지'와'야동 무료시청 절대 하지 마세요'는이제negatedaction분기에서제외된다. 기존즉시부정형/조사형도유지된다.

부정술어가없으면강조부사자체는veto하지않으므로'가입 무조건 혜택 제공'같은양성은살린다. 다른문장의'성인영상 무료시청'은별도CTA로평가하고부정된앞category/actionspan을빌리지않는다. 차단없이/차단해제의기존정보역할예외는바꾸지않았다. 새adult-context시험은부정8·별도긍정1·강조/차단회피1을더해27개로설계됐다.

한정된한국어수식어grammar라는범위는명시돼있다. 모든문장/반어/국제어를처리한다는주장도없고,그완전성을이번국소수정의추가차단조건으로삼지않는다. 알려진반례와긍정반례보존이명확한acceptance다.

## Medium Case undefined 해소 근거

contracts/src/case.ts:52-55는toolVersion문자열을확인한뒤decisionPolicy를한번계산한다. policy===undefined이면즉시false,policyVersion은integer검사를통과하고지원정책값과같아야한다. 따라서미지원suffix+missing/undefined/null이동시에true가되는이전경로가없다. 숫자가아닌값·비정수도거부된다.

TS시험은policy2/3/4×missing/undefined/null9개를official없이/맞춘official과함께거부하도록한다. native는u32필수역직렬화로원래거부했고r2에는같은missing/null표의시험만추가했다. nativeproductionmapping함수변경은없다. 역사policy2/무suffixpolicy2와새policy3의정상읽기는유지된다.

## 누적 정적 검수의 승인 범위

앞선정적검수와연결하여확인한범위는성인category/CTA동일문장·개행·근접pair·원문span·부정/공공정보/도서관대조,OCRcause보존·고정어휘진단·changing/throwinggetter안전성,판정policy3의TS/config/공식/추가result/nativeconfig/진단/Casewrite-read매핑이다.

공식schema는기존meta.tool_version값으로만policy3을식별하고새필드를추가하지않는다. Case schema1/configVersion1/text-policy-2증거형식은유지된다. 원문/evidence/selector/frame형식을바꾸거나기존policy2결과를재작성하는변경은없다. TEXT_POLICY_VERSION을decisionpolicy와분리해유지한것은타당하다. 국제성인광고영문범위는문서상미지원이며기존카지노영문지원과혼동하지않는다.

이전로그허용목록의Error.name두번읽기는r1에서snapshot한번읽기로해소됐고r2에서그source는불변이다. 기존실모델의image-embedding실패는이번diagnostics를이유로해결/skip처리하지않는다.

## 실행 검증과 남은 수용 공백

이번검수는실행/편집금지에따라gitread/diff/check·파일읽기·SHA계산만했다. 동시에별도guardworker가실행중인5파일108개는27+11+19+13+38의예상합계이며본검수는완료결과를받지않아PASS라고기록하지않는다. 이전r1의89PASS나구OCR8PASS를r2의108PASS로전용하지않는다.

최종실행결과를받으면정확한r2파일SHA/manifest와연결해조건을확인하면된다. 향후남은type/lint/build,실제ChromiumDOM/공식출력/TS-nativeCase저장·재시작왕복,Rust시험,실모델/nativeOCR실패원인및Windows설치본/D08/Excel은별도검증공백이다. 이들을국소정적코드결함으로혼동하지않고이번정적승인을출시/대회경쟁력확보선언으로확대하지않는다.

당장새guard기능·대형suite·VM·모델실행을추가할필요는없다. 부모가이미승인한순차고정실행결과를확인하는것이최소다음단계다. 소스/시험수정·stage/commit/push/guard/VM/Tasks변경은하지않았다.
