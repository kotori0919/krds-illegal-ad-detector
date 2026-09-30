import { describe, expect, it } from "vitest";
import {
  normalizeFrameSrc,
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
      'iframe[src="https://ads.example/x"] >>> iframe[src="https://ads.example/y"] >>> #ad',
    );
  });
});

describe("normalizeFrameSrc", () => {
  it("resolves relative iframe src to absolute URLs", () => {
    expect(normalizeFrameSrc("/frame.html", "https://example.kr/page")).toBe(
      "https://example.kr/frame.html",
    );
  });
});
