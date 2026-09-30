# GOAL.md

# 공공 웹사이트 불법광고 탐지 도구 개발 공모전
## Production Goal

Deadline:
2026-10-23 18:00 KST

Current objective:

Build, verify, package and document a complete Windows 11 submission for the
2026 행정안전부 / 한국지능정보사회진흥원
"공공 웹사이트 불법광고 탐지 도구 개발 공모전".

This goal is complete only when the actual submission artifact is ready.


# 1. Success definition

The application must:

1. accept one target website entry URL;
2. discover relevant lower pages;
3. inspect posts and content areas;
4. inspect comments where reachable;
5. inspect iframe contents including nested frames;
6. detect illegal advertisement content;
7. classify one of the four official concealment techniques;
8. identify the exact page and element;
9. show findings and evidence in a KRDS-based user interface;
10. generate valid `result.json`;
11. optionally generate `result_extra.json`;
12. run on Windows 11 without a GPU;
13. be usable by an evaluator without a development environment.


# 2. Official evaluation target

Qualification score:

- Correct detection count: 45
- Extraction accuracy: 35
- Detection time: 20

Timeout:
- 30 minutes

The development strategy must therefore prioritize:

    recall
      + precision
      + exact output
      + speed

before optional AI sophistication.


# 3. Final judging target

The final judging incorporates:

- converted quantitative evaluation: 50
- practical usability: 20
- deployability: 10
- creativity/originality: 20

Therefore the product must combine:

- strong official detection;
- clear evidence UI;
- simple operation;
- low deployment cost;
- additional meaningful detection intelligence.

Do not pursue creativity by weakening the qualification score.


# 4. Core architectural target

Implement:

React + TypeScript + Vite
        |
        v
KRDS Web Application
        |
        v
HostBridge
      /   \
Browser   Tauri 2
             |
             v
          Rust Core
             |
             v
      Scanner Supervisor
             |
             v
      Playwright Worker
             |
    +--------+---------+
    |                  |
Official Detection   Evidence Graph
    |                  |
    +--------+---------+
             |
        OCR / Decision
             |
       optional VLM
             |
        Result Engine


# 5. Repository target

Default repository:

    krds-illegal-ad-detector

Repository visibility:

    PRIVATE

Immediately establish:

- remote GitHub repository;
- project tracking issue;
- bootstrap branch;
- draft PR;
- CI.

Use `gh` CLI.

Do not duplicate an existing project repository.


# 6. Phase 0: Bootstrap

Target:
2026-09-30 to 2026-10-01

Tasks:

- inspect current workspace;
- inspect gh authentication;
- inspect existing repositories;
- initialize repo if necessary;
- create private GitHub remote;
- commit KODEX.md;
- commit GOAL.md;
- configure workspace;
- create tracking issue;
- create draft bootstrap PR;
- establish CI;
- establish lint/typecheck/test commands.

Deliver a remotely visible coherent initial state.


# 7. Phase 1: Contracts and architecture

Target:
2026-10-01 to 2026-10-02

Freeze Contract v0.

Required contracts:

- HostCapabilities
- HostBridge
- ScanRequest
- ScanSession
- ScanEvent
- Finding
- Evidence
- FramePath
- EvidenceNode
- EvidenceEdge
- OfficialResult
- OfficialFinding
- ExtraResult

Write:

- docs/ARCHITECTURE.md
- docs/DETECTION.md
- docs/KRDS_COMPLIANCE.md
- docs/ADR/

Do not begin broad parallel implementation until these contracts are coherent.


# 8. Phase 2: Synthetic evaluator first

Target:
2026-10-02 to 2026-10-04

Build a local deterministic test website before tuning detectors.

It must contain:

Official positives:
- HOMOGLYPH
- JAMO
- TRANSPARENT
- OFFSCREEN

Structural cases:
- nested iframe
- iframe relative src
- query-parameter pages
- same content through different links
- delayed content insertion

Negative cases:
- sr-only accessibility content
- hidden navigation
- hidden modal
- responsive elements
- legitimate Jamo text
- legitimate Unicode confusables
- normal display:none application state

Ground truth must be machine-readable.

Create evaluation output:

- TP
- FP
- FN
- precision
- recall
- elapsed time


# 9. Phase 3: Playwright crawler

Target:
2026-10-03 to 2026-10-06

Implement production crawler using Playwright API.

Required:

- input URL normalization;
- bounded crawl queue;
- same-site page traversal;
- subpage discovery;
- page deduplication;
- content deduplication where useful;
- post/detail page handling;
- iframe traversal;
- nested iframe traversal;
- network observation;
- redirects;
- popup suppression;
- download suppression;
- hard timeout;
- hostile-page safeguards.

External advertisement infrastructure is observed but not recursively crawled.


# 10. Phase 4: Selector engine

Target:
2026-10-04 to 2026-10-06

Implement exact location generation.

Required:

- deterministic CSS selector builder;
- stable attribute preference;
- class handling;
- nth-of-type fallback;
- iframe path;
- absolute iframe src;
- nested `>>>` serialization;
- selector uniqueness validation;
- selector round-trip tests.

No official finding may be emitted with an ambiguous selector.


# 11. Phase 5: Official semantic pipeline

Target:
2026-10-05 to 2026-10-09

Create a two-axis decision:

A. Is this illegal-advertisement content?
B. Which concealment technique applies?

The official finding exists only when required evidence supports both.

Implement a low-cost semantic system using:

- direct text;
- normalized text;
- URL/domain context;
- advertising vocabulary;
- illegal-content vocabulary;
- structured rules;
- optional lightweight decision model.

Prioritize precision on legitimate hidden content.


# 12. Phase 6: HOMOGLYPH

Implement:

- raw Unicode preservation;
- NFKC or appropriate normalization representation;
- script analysis;
- confusable mapping;
- mixed-script detection;
- fullwidth analysis;
- digit/letter confusables.

Create positive and negative fixtures.

Never mutate `evidence_text`.


# 13. Phase 7: JAMO

Implement Korean-aware:

- Compatibility Jamo;
- Choseong;
- Jungseong;
- Jongseong;
- reconstruction;
- spacing/evasion handling.

Test:

- decomposed advertising terms;
- spaced decomposition;
- mixed decomposition;
- legitimate educational/Jamo content.


# 14. Phase 8: TRANSPARENT

Use computed style and effective visibility.

Support at least official examples:

- same foreground/background color;
- opacity:0;
- color:transparent.

Also inspect:

- parent opacity;
- alpha;
- rendering state.

Add negative tests for ordinary invisible application elements.


# 15. Phase 9: OFFSCREEN

Support at least official examples:

- font-size:0
- font-size:1px
- absolute positioning with large negative coordinates
- display:none

Also evaluate practical variants:

- transforms;
- zero-size element;
- clipping;
- overflow concealment.

Use actual geometry, not CSS-string matching alone.


# 16. Phase 10: Official result engine

Target:
complete by 2026-10-10

Generate:

    result.json

Requirements:

- UTF-8
- no BOM
- valid JSON
- meta object
- findings array
- empty array if zero findings
- unique finding IDs
- exact official technique
- original evidence text
- elapsed timing
- tool version

Deduplicate by:

    url + location + technique

Create a validator that fails the build/release for invalid official output.


# 17. Phase 11: KRDS vertical product

Target:
2026-10-06 to 2026-10-11

Build the actual product flow.

Do not make a generic admin dashboard.

Screen 1:
탐지 시작

Contains:
- product title;
- concise description;
- URL field;
- primary action;
- expandable advanced configuration.

Screen 2:
탐지 진행

Contains:
- current stage;
- visited pages;
- queued pages;
- analyzed elements;
- candidates;
- confirmed findings;
- elapsed time;
- cancel action.

Screen 3:
탐지 결과

Contains:
- summary;
- counts by four official techniques;
- finding table;
- filters;
- evidence action;
- export action.

Screen 4:
탐지 근거

Contains:
- original text;
- normalized text;
- selector;
- iframe path;
- CSS;
- geometry;
- screenshot/crop if available;
- OCR;
- resource/infrastructure evidence;
- inference evidence clearly labelled.

Screen 5:
결과 검증 / 내보내기

Contains:
- schema status;
- selector status;
- duplicate status;
- required-field status;
- output path.

All screens must follow official KRDS principles and patterns.


# 18. KRDS merge gate

Every UI PR must answer:

- Which KRDS pattern is used?
- Which KRDS tokens are used?
- Is there any custom primitive?
- Why is it necessary?
- Keyboard tested?
- Focus tested?
- Error state tested?
- Empty state tested?
- Responsive state tested?
- Accessibility reviewed?

Maintain the answers in:

    docs/KRDS_COMPLIANCE.md

A significant unexplained KRDS deviation blocks merge.


# 19. Phase 12: Evidence Graph

Target:
2026-10-10 to 2026-10-14

Implement advertisement infrastructure observation.

Capture:

Page
Frame
Element
Resource
Creative
Domain
Redirect
Landing

Relations:

CONTAINS
LOADS
EMBEDS
DISPLAYS
LINKS_TO
REDIRECTS_TO
SIMILAR_TO

Use Playwright network events to collect external infrastructure without
recursively browsing uncontrolled websites.


# 20. Phase 13: Advertisement creative fingerprint

For likely advertisement assets collect:

- exact hash;
- perceptual hash;
- image dimensions;
- resource URL;
- source host;
- OCR fingerprint;
- click/landing relationship.

Use this to detect recurring creative families across changing content sites.

This is extra intelligence and must not corrupt official scoring.


# 21. Phase 14: OCR

Target:
2026-10-11 to 2026-10-15

Benchmark lightweight Korean OCR approaches.

Requirements:

- CPU suitable;
- Windows packaging feasible;
- no GPU required;
- no mandatory Python installation if avoidable;
- good Korean advertisement-text recognition.

OCR only candidate crops.

Do not OCR all pages by default.


# 22. Phase 15: Decision model

Use a small structured decision model only after deterministic evidence exists.

Inputs may contain:

- raw text;
- normalized text;
- OCR;
- CSS state;
- geometry;
- destination URL;
- infrastructure correlation;
- creative similarity.

Its job is to resolve ambiguous semantics.

It must not become the sole official detector.


# 23. Phase 16: Multimodal fallback

A compact multimodal model may be added for ambiguous visual advertisement
candidates only.

It must be:

- optional in the pipeline;
- CPU-aware;
- aggressively gated;
- benchmarked.

Do not run it per element.

If it materially harms 30-minute performance or memory, disable it by default.


# 24. Phase 17: result_extra.json

Target:
2026-10-15 to 2026-10-17

Implement useful extra detections only if they demonstrably work.

Possible types:

- REUSED_AD_CREATIVE
- AD_INFRASTRUCTURE_CORRELATION
- IMAGE_ONLY_ILLEGAL_AD
- REDIRECT_ADVERTISEMENT
- ZERO_WIDTH_OBFUSCATION
- OTHER_PROVEN_TECHNIQUE

Serialize as the competition extra format:

- meta
- findings
- technique = "ETC"
- extra_finding = type

Validate separately from result.json.


# 25. Phase 18: Tauri desktop

Target:
2026-10-14 to 2026-10-18

Implement Tauri 2 host.

Requirements:

- reuse canonical React UI;
- HostBridge;
- scanner process management;
- output file writing;
- resource management;
- restricted capability permissions;
- no arbitrary frontend shell execution.


# 26. Phase 19: Windows native integration

Target:
2026-10-16 to 2026-10-19

Use windows-rs only where native functionality is justified.

Highest priority:

- reliable child-process tree cleanup;
- scan cancellation;
- application exit cleanup.

Evaluate Windows Job Objects.

Test:

- normal completion;
- cancel;
- scanner crash;
- browser crash;
- application close during scan;
- repeat scan after failure.


# 27. Phase 20: Evaluation performance

Target:
continuous, freeze by 2026-10-20

Benchmark with an internal conservative baseline:

- Windows 11
- Intel 6th-generation-class CPU
- 4-6 cores
- 8 GB RAM
- no GPU

Measure:

- cold startup;
- crawl time;
- pages/sec;
- detector time;
- OCR latency;
- model latency;
- peak memory;
- process count;
- complete scan time.

Aim for substantial margin below the official 30-minute timeout.


# 28. Phase 21: Adversarial evaluation

Target:
2026-10-18 to 2026-10-20

Create attempts to defeat every detector.

Examples:

HOMOGLYPH:
- mixed Cyrillic/Latin
- fullwidth
- inserted punctuation
- digit substitution

JAMO:
- spaces
- compatibility Jamo
- mixed complete/decomposed syllables

TRANSPARENT:
- ancestor opacity
- inherited color
- background matching
- dynamic style changes

OFFSCREEN:
- transforms
- nested containers
- clipping
- negative coordinates
- tiny text

Crawler:
- nested iframe
- redirect
- duplicate URLs
- query variations
- delayed insertion

Fix valid failures.


# 29. Phase 22: Final KRDS and accessibility review

Target:
2026-10-19 to 2026-10-21

Independent reviewer must inspect:

- initial task clarity;
- KRDS hierarchy;
- form behavior;
- tables;
- dialogs;
- alerts;
- progress feedback;
- keyboard-only operation;
- focus handling;
- screen-reader semantics;
- error recovery;
- responsiveness;
- evidence readability.

Fix valid findings before release.


# 30. Phase 23: Submission artifacts

Target:
2026-10-20 to 2026-10-22

Produce all official development artifacts:

- Windows 11 executable/package;
- complete source code;
- execution/build manual;
- user manual.

Also prepare application-support material for the required application forms
and 5-10 page planning document.

The planning document should explain:

- background/problem;
- purpose;
- data and technologies;
- architecture;
- implementation;
- user flow;
- evidence/result-management UI;
- practical deployment;
- expected administrative benefit;
- originality;
- extra detection.


# 31. Phase 24: Clean-machine dry run

Target:
2026-10-21 to 2026-10-22

On the cleanest available Windows environment:

1. unpack release;
2. run without development tooling;
3. enter test URL;
4. scan;
5. inspect results;
6. generate result.json;
7. validate UTF-8/no BOM;
8. validate selector output;
9. close application;
10. verify no orphan processes;
11. repeat.

Then verify build from submitted source and manual.


# 32. Submission freeze

Internal code freeze target:

    2026-10-22

Submission target:

    before 2026-10-23 18:00 KST

Do not plan to finish at the official deadline.

Reserve the final period for:

- packaging mistakes;
- missing documents;
- Windows-specific failures;
- email attachment/size issues;
- signature/forms;
- final submission verification.


# 33. GitHub development workflow

Create one tracking issue:

    [Tracking] 2026 공공 웹사이트 불법광고 탐지 도구

Include:

- milestone checklist;
- current PR;
- test metrics;
- benchmark metrics;
- current risks;
- submission checklist.

Milestone PRs:

1. bootstrap + contracts
2. official crawler + four detectors
3. KRDS application
4. evidence intelligence + OCR
5. Tauri + Windows
6. release closure

Open PRs as drafts early.

Push tested intermediate work.

Update PR descriptions continuously.


# 34. Agent plan

Main Orchestrator:
- owns whole project;
- writes integration code;
- verifies sub-agents;
- manages remote GitHub state.

Architecture Reviewer:
- reviews contracts and module boundaries.

Web/KRDS Agent:
- React;
- KRDS;
- accessibility;
- product flow.

Scanner Agent:
- Playwright;
- crawl;
- network;
- frames;
- selectors.

Official Detection Agent:
- semantic gate;
- four official techniques;
- result correctness.

Intelligence Agent:
- OCR;
- pHash;
- Evidence Graph;
- optional decision/VLM.

Windows Agent:
- Tauri;
- windows-rs;
- process lifecycle;
- packaging.

Verification Agent:
- synthetic evaluator;
- adversarial cases;
- benchmark;
- clean release verification.

Run agents in parallel only after shared contracts are frozen.


# 35. Release-blocking gates

A release fails if ANY applies:

- result.json invalid;
- UTF-8 BOM exists;
- required field missing;
- invalid technique;
- ambiguous selector;
- official detector regression;
- critical false-positive regression;
- Windows build fails;
- scan cannot cancel;
- child browser processes leak;
- UI prevents keyboard operation;
- major KRDS violation remains;
- dependency/runtime missing on clean machine;
- build instructions fail;
- required source/manual missing.


# 36. Definition of Done

The project is done only when:

Official detection:
- four techniques verified;
- illegal-ad semantic gating verified;
- nested iframe verified;
- exact location verified;
- result.json verified.

Performance:
- GPU unnecessary;
- baseline CPU usable;
- no uncontrolled expensive inference;
- benchmark recorded.

Product:
- full KRDS workflow;
- accessible;
- meaningful evidence;
- error handling;
- cancellation;
- export validation.

Desktop:
- Windows 11 executable works;
- scanner works;
- process cleanup works;
- result file is produced.

Submission:
- source complete;
- build manual complete;
- user manual complete;
- application-document support complete;
- final package independently verified.

GitHub:
- current remote state pushed;
- open PR accurately describes state;
- tracking issue accurately describes state.

Only then may the agent report:

    SUBMISSION READY
