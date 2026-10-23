import { describe, expect, it } from "vitest";
import {
  normalizeFrameSrc,
  parseFrameLocation,
  serializeFramePath,
} from "../src/selector.js";

describe("serializeFramePath", () => {
  it("serializes a top-level selector with no frames", () => {
    expect(
      serializeFramePath({ framePath: [], selector: "#ad" }),
    ).toBe("#ad");
  });

  it("serializes nested frames with >>> separators", () => {
    expect(
      serializeFramePath({
        framePath: [
          { src: "https://ads.example/x", selector: "#outer" },
          { src: "https://ads.example/y", selector: "#inner" },
        ],
        selector: "#ad",
      }),
    ).toBe(
      '#outer >>> #inner >>> #ad',
    );
  });

  it("keeps duplicate document sources distinct and parses quoted separator text", () => {
    const left = serializeFramePath({ framePath: [{ src: "about:blank", selector: '#left[title="a >>> b"]' }], selector: "#ad" });
    const right = serializeFramePath({ framePath: [{ src: "about:blank", selector: "#right" }], selector: "#ad" });
    expect(left).not.toBe(right);
    expect(parseFrameLocation(left)).toEqual(['#left[title="a >>> b"]', "#ad"]);
    expect(() => parseFrameLocation("#left >>> ")).toThrow("invalid frame location");
  });
});

describe("normalizeFrameSrc", () => {
  it("resolves relative iframe src to absolute URLs", () => {
    expect(normalizeFrameSrc("/frame.html", "https://example.kr/page")).toBe(
      "https://example.kr/frame.html",
    );
  });
});
