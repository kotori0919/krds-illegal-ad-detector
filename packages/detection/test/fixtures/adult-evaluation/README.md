# Corpus provenance

These are text-only authored DOM fixtures, with no fetched adult media or live ad destination.

- `cases.json`: gold prepared before the policy edit (initial hash `a8e124fa...`); before implementation, display:none was corrected from TRANSPARENT to existing policy OFFSCREEN (`9bdc640d07f8991d973094f42854113b69636781d5f014fafe19480bddbc2e29`). First evaluation found TP6/FP1/FN0 (library video borrowing). This corpus was **promoted to regression**, and its FP was added to the development tests. Never report it as untouched holdout.
- `holdout.json`: authored after that repair, before its first run; hash `7ce86935ff4eafbe7b80f340c41eabf1e07a12ed320bfeca589d9fa111a75c5d`. No policy changes followed its evaluation. First run TP6/FP0/FN0, all six original texts and unique DOM identities resolved. This is a separate same-author authored holdout, **not** independent or blind external evidence.

Gold identifies the actual element (selector in its own document), source text and technique. Runtime selectors need not use the gold spelling: the harness compares live DOM node identity and exact original text after resolving each emitted complete frame location. Repeated identical comments must remain distinct; duplicate candidates are also passed to the official result engine to verify deduplication.

The production crawler discovers the two query-valued board pages and inspects nested frames; a separate normal document is crawled too. Each corpus has 3 visited top-level pages, 5 inspected documents and 6 positive element-technique pairs (HOMOGLYPH1/JAMO1/TRANSPARENT2/OFFSCREEN2). Normal hidden text is mixed into positive pages as well as the normal-only page. Finite words and templates, same host/origin, fixed settle window, no image/OCR, no independent labeling, no external-site accuracy estimate. Delay injection and cross-origin restrictions remain covered by existing tests rather than this holdout.
