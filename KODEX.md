# KODEX.md

## 0. Role of this document

This file is the permanent engineering constitution of this repository.

It applies to:
- the main coding agent;
- every delegated implementation agent;
- planners;
- reviewers;
- refactoring agents;
- testing agents;
- documentation agents.

`GOAL.md` defines the current delivery objective.

## Adoption invariants (2026-10-09)

The current user-authorized adoption goal supersedes historical product freezes
for internal behavior; the official JSON schema and historical artifacts remain
immutable. Corrected detector output records a new engine/policy version.
Raw evidence is never replaced by normalization, operator judgment or graph
projections. Commit validated official output before publishing an exportable
terminal state; optional evidence failures degrade independently. Cases belong
in writable per-user storage, never the installation directory. Review revisions
must reject stale writes. Reopening never crawls or fetches missing evidence.

Keep browser isolation fail-closed, public-only pinned batch transport, bounded
single-pass work, monotonic deadlines and owned process cleanup. External models
remain disabled and optional. React uses typed HostBridge operations only.
KRDS list/detail/keyboard/error behavior applies to saved cases and graph review.
Build inputs, source/policy identities, migrations and external NOT_RUN acceptance
must be explicit so a receiving team can build and operate without chat history.

If a temporary task conflicts with this file, this file wins unless the user
explicitly overrides the conflicting requirement.

The main agent is ultimately responsible for the repository and must verify
delegated work before treating it as complete.


# 1. Official source hierarchy

When requirements conflict, follow this order:

1. Explicit current user instruction.
2. Official 2026 Ministry of the Interior and Safety / NIA competition rules.
3. Official result.json schema and evaluation requirements.
4. This KODEX.md.
5. GOAL.md.
6. Architecture Decision Records.
7. Official KRDS documentation.
8. Official upstream technical documentation.
9. Existing project conventions.
10. Agent preference.

Do not silently replace an official competition requirement with an
architectural preference.


# 2. Product mission

Build a real Windows-capable public-website illegal-advertisement inspection
tool for the:

"공공 웹사이트 불법광고 탐지 도구 개발 공모전"

Organizer:
- 행정안전부

Host:
- 한국지능정보사회진흥원

Submission deadline:
- 2026-10-23 18:00 KST

The submission is not merely an AI demo.

It must be a usable inspection tool that:

1. accepts one entry URL;
2. crawls relevant site areas;
3. inspects pages, posts, comments and iframe contents;
4. identifies illegal-advertisement content;
5. identifies the required concealment technique;
6. identifies the exact element location;
7. presents understandable evidence to the user;
8. emits valid result.json;
9. runs on Windows 11 without requiring a GPU;
10. can be built from the submitted source code.


# PRODUCT / OPERATOR UX CONSTITUTION

The canonical user is a NIA or public-sector employee responsible for
Internet and public-website operations, not a developer. The interface must
remain understandable across ages and levels of computer proficiency.

Design around the operator's job: 점검할 사이트 입력 → 자동 점검 → 문제 확인 →
근거 검토 → 결과 저장 / 후속 업무. The three primary workflow states are
점검 설정, 사이트 점검, 결과 검토. Evidence inspection and export are actions
within 결과 검토, never separate workflow steps. Do not add permanent
dashboard navigation to this single-task product without a demonstrated need.

Normal operation requires one site address and sensible defaults. Put optional
controls under 상세 설정, technical evidence under 기술 정보, and non-official
intelligence under 추가 분석. Raw CSS selectors, session IDs, enum values,
model scores, pHashes, worker statistics, and JSON are never primary UI.
Keep essential decision evidence visible; progressive disclosure must not
conceal why a finding matters.

Use clear Korean labels, readable text and target sizes, keyboard navigation,
visible focus, explicit non-colour-only status, actionable errors, and simple
recovery paths. No user must know DOM, CSS, Unicode normalization, iframe
internals, Playwright, OCR architecture, or model confidence mechanics to
complete a scan. A finding must name the affected page and explain the
observed advertisement and concealment in ordinary Korean. Inference must
remain distinguishable from observation.

Performance is part of the user experience. Show real scan stage, elapsed
time, confirmed counts, meaningful recent activity, partial results and page
failures where available, and a safe cancel action. Never show invented
percentages or block the UI for background scanning. Preserve the cheap-first
pipeline; capture visual evidence selectively, not for every element.

Optimize repeated work: filters, page grouping, and finding inspection must
retain list context; saving results and starting another scan must be direct.
KRDS is the normative behavioural source for hierarchy, forms, statuses,
search and filtering, result lists, feedback, dialogs, errors, accessibility,
responsive layout, and task completion, not merely for colours and tokens.
Record the applied patterns and any unverified behaviour in
`docs/KRDS_COMPLIANCE.md`.

Product V2 includes scanner architecture and Windows acceptance, not only the
three-stage interface. A single monotonic deadline governs discovery,
detection, evidence, and finalization. Process each live page once where
possible: discover links, inspect DOM/CSS/geometry and live frames, detect,
capture selected evidence, then close it. Use a bounded page-worker pool,
initially 2 workers on <=4 logical CPUs, 3 on 5-8, and 4 above 8, with a
hard maximum of 4. Benchmark this policy on the 4-vCPU/8-GB/no-GPU Windows
target. Never launch an unbounded `Promise.all` over discovered pages or
re-navigate each crawled page solely to detect it.

Concurrent completion order must not choose pages at a scope limit or assign
finding IDs. Apply deterministic frontier admission, canonical deduplication
and sorting, then assign IDs. The official finding set must agree at worker
counts 1, 2, 3, and 4 on the same realistic scenario. A worker may spend
remaining time on official detection only if safe finalization remains;
optional visual evidence yields first. Desired acceptance time is 1200 s,
normal configured budget 1500 s, internal hard stop 1650 s, and the official
ceiling 1800 s. Do not show the internal guard to ordinary operators.

KRDS Adaptive is the V2 style track. Stay close to the base KRDS appearance
unless a service need justifies an extension. Implement primitive -> semantic
-> component tokens; components must not use arbitrary raw style values where
KRDS tokens exist. Map each interaction to an official component/basic/service
pattern before implementing it. The Product V2 release gate covers keyboard
operation, focus and restoration, 360px reflow, 200% zoom, non-colour states,
loading/empty/error/partial/cancel/save states, dialog focus, live status,
clear Korean wording, and targets suitable for mixed-age operators. An
unexplained KRDS pattern deviation blocks release.


# 3. Evaluation-driven engineering priorities

The official qualification evaluation is:

- Correct detections: 45 points
- Extraction accuracy: 35 points
- Detection time: 20 points

Hard timeout:
- 30 minutes

Therefore optimize in this order:

1. Never miss obvious official findings.
2. Minimize false positives.
3. Produce exact and valid location/technique output.
4. Stay comfortably below the timeout.
5. Only then increase extra intelligence.

Do not sacrifice official scoring performance for experimental features.


# 4. Official finding definition

The four official techniques are exactly:

- HOMOGLYPH
- JAMO
- TRANSPARENT
- OFFSCREEN

A hidden element alone is NOT necessarily an illegal advertisement.

The official detector must distinguish:

    illegal-ad semantics
            AND
    concealment technique

from legitimate hidden UI such as:

- accessibility text;
- responsive navigation;
- inactive dialogs;
- collapsed controls;
- screen-reader labels;
- application state;
- normal invisible layout elements.

False-positive prevention is a first-class requirement.


# 5. Official versus extended detection

`result.json` is sacred.

Only the four official techniques belong in `result.json`.

Experimental intelligence belongs in `result_extra.json`.

Examples of extra intelligence:

- advertisement infrastructure correlation;
- reused advertisement creative;
- image-only illegal advertisement;
- redirect-chain analysis;
- suspicious iframe infrastructure;
- zero-width obfuscation;
- low-contrast concealment;
- CSS clipping variants;
- delayed injected advertisement;
- repeated advertisement asset fingerprint.

For extended findings use the official extra-result convention:

- technique = "ETC"
- extra_finding = project-defined descriptive type

Do not invent additional official technique values.


# 6. Official output invariants

`result.json` must:

- be UTF-8;
- contain no BOM;
- be valid JSON;
- contain `meta`;
- contain `findings`;
- contain `findings: []` when no findings exist;
- use one flat findings array;
- never create per-page result arrays.

Official finding identity is:

    url + location + technique

Each combination produces one finding.

If one element contains two different official techniques, emit two findings.

If the same element contains multiple strings using the same technique,
emit one finding for that technique.


# 7. Official fields

Internal contracts must be able to losslessly produce:

meta:
- topic
- entry_url
- started_at
- finished_at
- elapsed_sec
- tool_version

finding:
- id
- url
- is_violation
- location
- evidence_text
- technique

`evidence_text` must preserve the original, pre-normalization source text.

Never replace it with:
- normalized Unicode;
- OCR corrections;
- model summaries;
- translated text.

Derived forms belong in internal evidence only.


# 8. Location correctness is critical

The evaluator checks whether `location` resolves to the correct webpage
element.

A selector matching multiple elements is unacceptable.

Selector generation is a core subsystem.

Preferred strategy:

1. stable unique ID;
2. stable attribute;
3. tag + meaningful class;
4. parent-child path;
5. nth-of-type fallback.

Every emitted selector should be round-trip validated when technically
possible:

    generated selector
        ->
    querySelector/querySelectorAll
        ->
    exactly intended element

For iframe content serialize according to the competition convention:

    iframe[src="ABSOLUTE_URL"] >>> selector

For nested frames repeat `>>>`.

Relative iframe src values must be normalized to absolute URLs.


# 9. URL canonicalization policy

Internal URL handling must account for evaluation semantics.

Normalize carefully:

- trailing slash differences;
- http/https equivalence where required for evaluation logic;
- fragment exclusion;
- query parameter ordering;
- query parameter values.

Different query values may identify different pages.

Do not aggressively canonicalize queries into one page.


# 10. Web-first architecture

The canonical product is a React web application.

Use:

- React
- TypeScript
- Vite

The desktop application is the same application hosted by Tauri.

Do not create a second independent desktop UI.

Canonical architecture:

React
  |
Application Services
  |
HostBridge
  +-- BrowserHost
  +-- TauriHost
          |
       Tauri Rust Core
          |
       Scanner Host
          |
       Playwright Worker
          |
       Detection Pipeline


# 11. React must remain platform-independent

Normal React code MUST NOT directly import Tauri APIs.

Forbidden in ordinary views/components:

    import { invoke } from "@tauri-apps/api/core"

Instead use the project abstraction:

    HostBridge

Examples:

    host.startScan(...)
    host.cancelScan(...)
    host.exportResult(...)
    host.getCapabilities(...)

Tauri-specific code belongs only inside platform adapters.

This requirement is architectural, not optional.


# 12. Host capability model

The application must model capabilities explicitly.

Example:

HostCapabilities:
- localScan
- filesystem
- localInference
- nativeProcessControl
- windowsIntegration

BrowserHost may provide:
- UI
- replay
- demo
- stored-result inspection
- synthetic fixtures

TauriHost additionally provides:
- arbitrary local scanning
- Playwright execution
- local models
- filesystem export
- process supervision
- Windows-specific integration

Do not weaken browser security to simulate desktop capability.


# 13. Tauri is a thin native host

Tauri responsibilities:

- React hosting;
- HostBridge native implementation;
- scanner lifecycle;
- local filesystem operations;
- resource paths;
- packaging;
- native dialogs where required;
- process supervision;
- narrowly scoped Windows integration.

Do not move detection semantics into arbitrary Tauri commands.

Business logic belongs in reusable domain/scanner modules.


# 14. Windows API policy

Windows integration uses Rust.

Preferred order:

1. Tauri capability or plugin;
2. safe Rust abstraction;
3. focused Windows crate if available;
4. `windows` crate through windows-rs;
5. `windows-sys` only where raw FFI is justified.

All Win32 unsafe code must remain behind a small safe wrapper.

Never expose raw Windows handles throughout application logic.


# 15. Process-tree ownership

The desktop host owns every scanner process it starts.

It must support:

- start;
- cancellation;
- timeout;
- crash detection;
- exit cleanup;
- descendant cleanup;
- subsequent scan recovery.

Evaluate Windows Job Objects for:

Tauri
  -> scanner worker
      -> browser
          -> browser renderer processes

Closing or cancelling the application must not leave orphan browser processes.


# 16. Production browser policy

Use Playwright API for production scanning.

Playwright CLI is allowed and encouraged for:

- development inspection;
- reproduction;
- E2E tests;
- debugging;
- agent-assisted browser work.

Do not build production scanning around repeatedly spawning Playwright CLI
and parsing human-oriented output.

The final Windows package must not assume Node.js is preinstalled.

If the scanner relies on Node/Playwright, package the required runtime or
compile/bundle the sidecar reproducibly.


# 17. Crawl scope

The competition gives one entry URL and expects relevant sub-page inspection.

Default navigation crawl scope:

- same site / same controlled website;
- bounded;
- deduplicated;
- depth/queue limited.

External resources are still observed.

Do NOT recursively crawl arbitrary external advertisement sites.

For external domains collect evidence such as:

- resource host;
- iframe origin;
- href target;
- redirect target;
- landing domain where safely resolvable.

This preserves speed and safety.


# 18. Hostile-page assumption

Every scanned page is untrusted.

Defend against:

- infinite redirects;
- endless DOM mutation;
- popup storms;
- automatic downloads;
- excessive navigation;
- huge resources;
- hanging requests;
- infinite scrolling;
- CPU abuse;
- memory abuse;
- deceptive JavaScript.

Apply hard operational limits.

Never allow inspected content to execute arbitrary local commands.


# 19. Detection pipeline

Prefer cheap deterministic evidence before expensive inference.

Target order:

URL/domain analysis
  ->
DOM extraction
  ->
Unicode analysis
  ->
computed CSS
  ->
geometry
  ->
frame analysis
  ->
network/resource evidence
  ->
image fingerprint
  ->
candidate OCR
  ->
structured decision model
  ->
small multimodal fallback

Do not run OCR or multimodal inference over the entire page by default.


# 20. Illegal-ad semantic gate

Technique detection and content classification are separate concerns.

Conceptually:

    TechniqueEvidence
        +
    IllegalAdvertisementEvidence
        ->
    OfficialFinding

Illegal-ad semantics may be derived from:

- raw text;
- normalized Unicode;
- OCR text;
- destination URL;
- advertisement vocabulary;
- structured rules;
- lightweight model evidence.

Do not classify ordinary hidden UI as an illegal advertisement solely because
CSS concealment exists.


# 21. HOMOGLYPH detector

Use deterministic Unicode analysis first.

Keep:

- raw text;
- normalized text;
- codepoints;
- script information;
- confusable mapping;
- suspicious mixed-script evidence.

Cover:

- fullwidth forms;
- Cyrillic/Latin lookalikes;
- digit/letter substitutions;
- other visually confusable Unicode;
- mixed-script evasion.

Do not destroy original evidence.


# 22. JAMO detector

Implement Korean-specific Jamo handling.

Handle relevant forms of:

- Hangul syllables;
- Choseong;
- Jungseong;
- Jongseong;
- Compatibility Jamo.

Test spaced and fragmented patterns.

Keep raw and reconstructed text separately.


# 23. TRANSPARENT detector

Inspect computed style and rendering context.

Consider:

- color: transparent;
- alpha;
- opacity;
- ancestor opacity;
- foreground/background equivalence where appropriate;
- actual rendered visibility.

Do not blindly treat every `opacity:0` element as an official violation.

Require content relevance.


# 24. OFFSCREEN detector

Use actual geometry plus computed style.

Cover competition examples and practical variants:

- font-size 0-1px;
- large negative positioning;
- display:none;
- zero-size rendering;
- transformed offscreen elements;
- clipping;
- hidden overflow where meaningful.

Again, concealment alone is not illegal-ad proof.


# 25. Advertisement infrastructure intelligence

Maintain an Evidence Graph.

Node classes may include:

- Page
- Frame
- Element
- Resource
- Creative
- Domain
- Redirect
- Landing

Edges may include:

- CONTAINS
- LOADS
- EMBEDS
- DISPLAYS
- LINKS_TO
- REDIRECTS_TO
- SIMILAR_TO

Capture repeated advertisement infrastructure without claiming unsupported
operator identity.

Allowed wording:

- correlated infrastructure;
- related technical infrastructure;
- shared indicators;
- recurring advertisement infrastructure.

Do not infer nationality or personal identity from:
- WHOIS privacy data;
- CDN location;
- IP geolocation;
- nameserver location.


# 26. Creative fingerprinting

For candidate advertisement images, optionally record:

- SHA-256 or equivalent exact hash;
- perceptual hash;
- dimensions;
- media type;
- OCR fingerprint;
- source host;
- click destination.

This is supporting evidence and extended intelligence.

Image similarity alone must not create an official finding.


# 27. OCR policy

OCR is an auxiliary candidate analyzer.

Do not OCR every screenshot.

Candidate sources:

- img;
- canvas;
- SVG;
- CSS background image;
- image-only link;
- suspicious creative;
- known recurring advertisement infrastructure.

Pipeline:

candidate
  ->
crop
  ->
OCR
  ->
text normalization
  ->
semantic evidence

The chosen OCR backend must be benchmarked on Korean text and CPU.


# 28. Model policy

AI is optional under the official competition rules.

Therefore the project MUST NOT make official operation dependent on an
external AI service.

Required four-technique detection must work offline on the evaluation PC.

A local decision model or multimodal model may augment uncertain cases.

A remote API may exist only as an optional, disabled-by-default extension
after the offline official path is complete.

Never require a GPU for official evaluation.


# 29. Baseline machine

Optimize for:

- Windows 11
- GPU-less general-purpose PC
- Intel 6th-generation-class CPU as an internal conservative target
- 4-6 CPU cores
- 8 GB RAM target where practical

Do not assume:

- CUDA;
- AVX-512;
- modern NPU;
- large core counts;
- high-memory workstation hardware.


# 30. KRDS is a hard product invariant

The UI must consistently follow the current official KRDS.

Official KRDS documentation is the normative UI/UX source.

KRDS is not:
- a color palette;
- a government-looking theme;
- an optional styling pass.

It governs:

- hierarchy;
- layout;
- typography;
- tokens;
- components;
- forms;
- buttons;
- dialogs;
- navigation;
- tables;
- feedback;
- error handling;
- accessibility;
- interaction patterns.


# 31. KRDS implementation rule

Do not implement a generic SaaS dashboard and "KRDS-ify" it later.

KRDS must be applied from the first UI commit.

Before creating a new primitive component, check whether KRDS already defines
an equivalent.

Service-specific composites are allowed:

- ScanStart
- ScanProgress
- FindingTable
- EvidencePanel
- ScanSummary
- InfrastructureView
- ExportValidation

But they must be composed from KRDS-consistent primitives.


# 32. KRDS source-of-truth rule

A React component library is NOT automatically authoritative.

If a community React library differs from official KRDS guidance:

    official KRDS wins.

Maintain:

    docs/KRDS_COMPLIANCE.md

For each major screen document:

- official KRDS pattern/component;
- token usage;
- keyboard behavior;
- accessibility behavior;
- responsive behavior;
- intentional deviation and justification.


# 33. KRDS visual discipline

Avoid arbitrary hardcoded:

- colors;
- spacing;
- radius;
- shadows;
- typography;
- focus styles.

Prefer KRDS semantic tokens.

Custom drawing values are allowed only where KRDS has no meaningful equivalent,
for example:

- screenshot annotation;
- OCR box overlay;
- graph visualization;
- technical evidence diagrams.

Surrounding controls still follow KRDS.


# 34. Accessibility is functional correctness

Treat accessibility defects as release-blocking defects.

Require:

- semantic HTML;
- keyboard navigation;
- visible focus;
- labelled controls;
- accessible dialogs;
- screen-reader-compatible progress;
- meaningful error messages;
- sufficient contrast;
- non-color-only status communication;
- valid table semantics;
- logical heading structure;
- reduced-motion consideration.

The public-sector use case makes this especially important.


# 35. Required product journey

Primary workflow:

    점검 설정 (URL 입력)
      ->
    사이트 점검 (진행 및 중지)
      ->
    결과 검토 (탐지 항목별 / 페이지별, 근거 확인, 결과 저장)

Avoid unnecessary dashboard pages.


# 36. Progress presentation

Do not fabricate a percentage when total crawl work is unknown.

Expose real state such as:

- visited pages;
- queued pages;
- frames inspected;
- elements analyzed;
- candidates;
- confirmed findings;
- elapsed time;
- current detector stage.

Use an indeterminate progress presentation where appropriate.


# 37. Evidence UI

A finding must explain itself.

Display separately:

Observed:
- raw text;
- DOM location;
- CSS;
- geometry;
- frame;
- URL/resource relationship.

Derived:
- normalized text;
- confusable skeleton;
- OCR;
- perceptual similarity;
- infrastructure correlation.

Inference:
- decision model result;
- multimodal judgement;
- confidence.

Never render inference as if it were directly observed evidence.


# 38. Final output validation

Before writing official output, validate:

- JSON parseability;
- UTF-8 without BOM;
- meta fields;
- required finding fields;
- unique IDs;
- valid technique enum;
- duplicate finding identity;
- URL;
- selector uniqueness;
- selector round trip where possible.

Output validation failure blocks release.


# 39. Testing strategy

Maintain synthetic fixtures for positive AND negative cases.

Positive:
- HOMOGLYPH;
- JAMO;
- transparent illegal ad;
- offscreen illegal ad;
- nested iframe cases;
- combined techniques.

Negative:
- screen-reader-only accessibility text;
- hidden responsive navigation;
- legitimate display:none modal;
- collapsed menu;
- normal transparent animation state;
- legitimate Unicode text;
- legitimate Korean Jamo educational content.

Measure:

- TP;
- FP;
- FN;
- precision;
- recall;
- elapsed time.


# 40. Competition artifact requirements

Release closure must include:

- Windows 11 executable/package;
- complete source code;
- execution/build manual;
- user manual;
- application UI;
- result.json generation;
- result_extra.json if extra detection is included.

Do not call the submission ready without all required artifacts.


# 41. GitHub authority

The user explicitly authorizes:

- `gh` CLI;
- remote repository creation;
- remote branches;
- commits;
- pushes;
- issues;
- draft pull requests;
- PR updates.

The purpose is continuous user visibility and steering.


# 42. Repository bootstrap

First run:

    gh auth status
    git status
    git remote -v

Check whether an existing appropriate repository already exists.

Do not create duplicates.

If none exists, default repository name:

    krds-illegal-ad-detector

Create it private:

    gh repo create krds-illegal-ad-detector \
      --private \
      --source=. \
      --remote=origin

Do not make it public without explicit permission.


# 43. Remote progress policy

Remote GitHub state must reflect real progress.

Create:

- one project tracking issue;
- milestone branches;
- draft PRs;
- meaningful intermediate commits.

The user should be able to open GitHub and determine:

- what works;
- what is under development;
- what failed;
- what remains;
- current tests;
- current benchmarks;
- important architectural decisions.


# 44. Branch policy

Keep branch count small.

Suggested milestones:

- dev/bootstrap
- dev/official-detectors
- dev/evidence-intelligence
- dev/windows
- dev/release

Sub-agents may use worktrees or short local branches.

Do not create permanent branches for every agent.


# 45. PR policy

Open a draft PR early for meaningful milestones.

Update PR body with:

- scope;
- completed items;
- remaining items;
- test results;
- screenshots for UI;
- benchmarks for scanner changes;
- risks;
- ADR links.

Push meaningful intermediate commits.

Do not generate meaningless progress commits.


# 46. Main-branch safety

Unless the user explicitly authorizes autonomous merging:

- do not merge milestone PRs to main;
- do not force-push main;
- do not rewrite shared history;
- do not delete the repository;
- do not destroy user work.

The user must be able to steer from open PRs.


# 47. Multi-agent ownership

Main agent owns:

- architecture;
- contracts;
- workspace root;
- integration;
- GitHub state;
- release.

Recommended implementation domains:

Web/KRDS Agent:
- apps/web
- packages/ui

Scanner Agent:
- crawling
- Playwright
- frames
- network
- selectors

Detection Agent:
- official detectors
- semantic gate
- Evidence Graph

Intelligence Agent:
- OCR
- image fingerprinting
- decision model
- optional multimodal fallback

Windows Agent:
- Tauri
- process supervision
- windows-rs
- packaging

Verification Agent:
- fixtures
- adversarial tests
- benchmark
- release validation

Agents must not independently redefine shared contracts.


# 48. Contract ownership

Shared contracts are modified by the main agent or with explicit main-agent
approval.

Sub-agents requesting a contract change must explain:

- why;
- affected modules;
- migration cost;
- compatibility impact;
- test changes.

Do not allow architecture drift through duplicated DTOs.


# 49. Mandatory reviews

Before milestone completion run independent review for:

Architecture:
- boundary violations
- coupling
- duplicated abstractions
- contract drift

KRDS/accessibility:
- official pattern use
- token consistency
- keyboard
- semantics
- focus
- errors
- responsive behavior

Adversarial detection:
- false positives
- concealment bypasses
- Unicode bypasses
- iframe edge cases
- selector failure

Performance/security:
- process leaks
- memory
- CPU
- navigation loops
- malicious pages
- unsafe Tauri privileges
- Windows cleanup


# 50. No fake completion

Never mark work complete because:

- a sub-agent says it works;
- source code was generated;
- a build was not run;
- only happy paths passed;
- an AI model was downloaded;
- a screenshot looked correct;
- JSON exists but was not validated.

Completion requires evidence.


# 51. Final engineering principle

At each major decision ask:

1. Does this improve the 45-point detection metric?
2. Does this preserve the 35-point precision metric?
3. Does this remain safely inside the 30-minute limit?
4. Does this improve actual public-sector usability?
5. Does this preserve KRDS consistency?
6. Does this run without a GPU?
7. Can this finding be explained?
8. Can it be tested?
9. Can the user inspect the work on GitHub?

If the added complexity does not improve one of these, remove it.
