import { describe, expect, it } from "vitest";
import { contentKey, isSameSite, normalizeUrlKey } from "../src/urls.js";

describe("normalizeUrlKey", () => {
  it("merges trailing-slash variants", () => {
    expect(normalizeUrlKey("https://example.kr/page")).toBe(
      normalizeUrlKey("https://example.kr/page/"),
    );
  });

  it("ignores fragments", () => {
    expect(normalizeUrlKey("https://example.kr/p#a")).toBe(
      normalizeUrlKey("https://example.kr/p#b"),
    );
  });

  it("ignores query-param order but keeps values", () => {
    expect(normalizeUrlKey("https://example.kr/b?a=1&b=2")).toBe(
      normalizeUrlKey("https://example.kr/b?b=2&a=1"),
    );
    expect(normalizeUrlKey("https://example.kr/b?id=101")).not.toBe(
      normalizeUrlKey("https://example.kr/b?id=102"),
    );
  });
});

describe("isSameSite", () => {
  it("accepts identical host, rejects subdomains and outsiders", () => {
    expect(isSameSite("example.kr", "https://example.kr/x")).toBe(true);
    expect(isSameSite("example.kr", "https://sub.example.kr/x")).toBe(false);
    expect(isSameSite("example.kr", "https://ads.example/x")).toBe(false);
    expect(isSameSite("example.kr", "not a url")).toBe(false);
  });
});

describe("contentKey", () => {
  it("collapses identical bodies and separates different ones", () => {
    expect(contentKey("hello")).toBe(contentKey("hello"));
    expect(contentKey("hello")).not.toBe(contentKey("hello!"));
  });
});
