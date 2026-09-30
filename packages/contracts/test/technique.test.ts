import { describe, expect, it } from "vitest";
import { isOfficialTechnique } from "../src/technique.js";

describe("isOfficialTechnique", () => {
  it("accepts the four official values and rejects the rest", () => {
    for (const t of ["HOMOGLYPH", "JAMO", "TRANSPARENT", "OFFSCREEN"]) {
      expect(isOfficialTechnique(t)).toBe(true);
    }
    expect(isOfficialTechnique("ETC")).toBe(false);
    expect(isOfficialTechnique("homoglyph")).toBe(false);
    expect(isOfficialTechnique(42)).toBe(false);
  });
});
