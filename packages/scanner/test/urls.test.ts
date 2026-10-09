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

  it("keeps encoded delimiters and literal plus signs distinct from query structure", () => {
    for (const [encoded, structured] of [
      ["a=b%26c%3Dd", "a=b&c=d"],
      ["a%3Db=c", "a=b%3Dc"],
      ["a=%2B", "a=+"],
    ]) {
      expect(normalizeUrlKey(`https://example.kr/p?${encoded}`)).not.toBe(
        normalizeUrlKey(`https://example.kr/p?${structured}`),
      );
    }
    expect(normalizeUrlKey("https://example.kr/p?tag=%ED%95%9C%EA%B8%80&tag=x%26y")).toBe(
      normalizeUrlKey("https://example.kr/p?tag=x%26y&tag=%ED%95%9C%EA%B8%80"),
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
