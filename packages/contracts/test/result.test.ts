import { describe, expect, it } from "vitest";
import {
  findingIdentityKey,
  serializeOfficialResult,
  validateExtraResult,
  validateOfficialResult,
  validateOfficialResultText,
  type OfficialResult,
} from "../src/result.js";

function validResult(): OfficialResult {
  return {
    meta: {
      topic: "test",
      entry_url: "https://example.kr/",
      started_at: "2026-09-30T00:00:00.000Z",
      finished_at: "2026-09-30T00:01:00.000Z",
      elapsed_sec: 60,
      tool_version: "0.1.0",
    },
    findings: [
      {
        id: "f1",
        url: "https://example.kr/page",
        is_violation: true,
        location: "#ad",
        evidence_text: "원본 텍스트",
        technique: "HOMOGLYPH",
      },
    ],
  };
}

describe("validateOfficialResult", () => {
  it("accepts a valid result with one finding", () => {
    expect(validateOfficialResult(validResult())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("accepts an empty findings array", () => {
    const r = validResult();
    r.findings = [];
    expect(validateOfficialResult(r).ok).toBe(true);
  });

  it("rejects a non-object root", () => {
    expect(validateOfficialResult([]).ok).toBe(false);
  });

  it("rejects missing meta fields", () => {
    const r = validResult();
    // @ts-expect-error intentional malformed fixture
    delete r.meta.tool_version;
    const out = validateOfficialResult(r);
    expect(out.ok).toBe(false);
    expect(out.errors).toContain("meta.tool_version is required");
  });

  it("requires findings to be a flat array", () => {
    expect(
      validateOfficialResult({ meta: validResult().meta }).errors,
    ).toContain("findings must be an array");
  });

  it("rejects invented technique values", () => {
    const r = validResult();
    // @ts-expect-error intentional malformed fixture
    r.findings[0].technique = "ZERO_WIDTH";
    const out = validateOfficialResult(r);
    expect(out.ok).toBe(false);
    expect(
      out.errors.some((e) => e.includes("findings[0].technique")),
    ).toBe(true);
  });

  it("rejects ETC inside result.json", () => {
    const r = validResult();
    // @ts-expect-error intentional malformed fixture
    r.findings[0].technique = "ETC";
    expect(validateOfficialResult(r).ok).toBe(false);
  });

  it("rejects duplicate url+location+technique identity", () => {
    const r = validResult();
    r.findings.push({ ...r.findings[0], id: "f2" });
    const out = validateOfficialResult(r);
    expect(out.ok).toBe(false);
    expect(
      out.errors.some((e) => e.includes("duplicates url+location+technique")),
    ).toBe(true);
  });

  it("allows the same element with two different techniques", () => {
    const r = validResult();
    r.findings.push({ ...r.findings[0], id: "f2", technique: "JAMO" });
    expect(validateOfficialResult(r).ok).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const r = validResult();
    r.findings.push({ ...r.findings[0] });
    const out = validateOfficialResult(r);
    expect(out.ok).toBe(false);
    expect(out.errors.some((e) => e.includes("id is duplicated"))).toBe(true);
  });
});

describe("validateOfficialResultText", () => {
  it("accepts serialized output", () => {
    const text = serializeOfficialResult(validResult());
    expect(validateOfficialResultText(text).ok).toBe(true);
  });

  it("serializes without BOM", () => {
    const text = serializeOfficialResult(validResult());
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text.startsWith("{")).toBe(true);
  });

  it("rejects a BOM prefix", () => {
    const text = `\uFEFF${serializeOfficialResult(validResult())}`;
    const out = validateOfficialResultText(text);
    expect(out.ok).toBe(false);
    expect(out.errors).toContain("result.json must not contain a BOM");
  });

  it("rejects invalid JSON", () => {
    expect(validateOfficialResultText("{oops").errors).toContain(
      "result.json must be valid JSON",
    );
  });

  it("round-trips Korean text as strict UTF-8 without BOM", () => {
    const r = validResult();
    r.findings[0].evidence_text = "Ｋ카지노 신규가입 꽁머니 3만원 지급";
    const text = serializeOfficialResult(r);
    const bytes = new TextEncoder().encode(text);
    expect([bytes[0], bytes[1], bytes[2]].join(",")).not.toBe("239,187,191");
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    expect(validateOfficialResultText(decoded).ok).toBe(true);
    expect(JSON.parse(decoded).findings[0].evidence_text).toBe(r.findings[0].evidence_text);
  });
});

describe("validateExtraResult", () => {
  it("accepts an ETC finding with extra_finding", () => {
    const out = validateExtraResult({
      meta: validResult().meta,
      findings: [
        {
          id: "x1",
          url: "https://example.kr/page",
          is_violation: true,
          location: "#ad",
          evidence_text: "원본",
          technique: "ETC",
          extra_finding: "REUSED_AD_CREATIVE",
        },
      ],
    });
    expect(out).toEqual({ ok: true, errors: [] });
  });

  it("rejects official techniques in the extra file", () => {
    const out = validateExtraResult({
      meta: validResult().meta,
      findings: [
        {
          id: "x1",
          url: "https://example.kr/page",
          is_violation: true,
          location: "#ad",
          evidence_text: "원본",
          technique: "HOMOGLYPH",
          extra_finding: "REUSED_AD_CREATIVE",
        },
      ],
    });
    expect(out.ok).toBe(false);
  });
});

describe("findingIdentityKey", () => {
  it("distinguishes technique but not id", () => {
    const a = findingIdentityKey({
      url: "u",
      location: "l",
      technique: "HOMOGLYPH",
    });
    const b = findingIdentityKey({
      url: "u",
      location: "l",
      technique: "JAMO",
    });
    expect(a).not.toBe(b);
  });
});
