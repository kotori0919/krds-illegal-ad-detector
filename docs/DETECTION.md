# Detection (placeholder — Phase 5+)

Two-axis decision: `TechniqueEvidence + IllegalAdvertisementEvidence → OfficialFinding`.

- Cheap deterministic evidence first (URL/domain → DOM → Unicode → CSS →
  geometry → frames → network → fingerprint → gated OCR → decision → optional VLM).
- Concealment alone never proves an illegal ad; legitimate hidden UI
  (sr-only, nav, modals, app state) must not fire.
- `evidence_text` preserves the original pre-normalization source text.

Full detector specs (HOMOGLYPH / JAMO / TRANSPARENT / OFFSCREEN + semantic
gate) land with Phase 1 contracts and Phases 5–9.
