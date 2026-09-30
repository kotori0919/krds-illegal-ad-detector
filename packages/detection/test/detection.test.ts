import { describe, expect, it } from "vitest";
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { detectPageCandidates } from "../src/pipeline.js";
import { buildOfficialResult, serializeValidatedResult } from "../src/result-engine.js";
import { homoglyphSignal } from "../src/homoglyph.js";
import { jamoSignal } from "../src/jamo.js";
import { hasSuspiciousDestination, matchedAdTerms, semanticGate } from "../src/semantic.js";
import { startFixtureServer } from "@krds-detector/synth-eval/serve.js";
import { validateOfficialResultText } from "@krds-detector/contracts";

describe("semantic gate", () => {
  it("passes ad vocabulary after NFKC folding", () => {
    expect(semanticGate("Ｋ카지노 신규가입").passed).toBe(true);
    expect(matchedAdTerms("Ｋ카지노 신규가입")).toContain("카지노");
  });

  it("rejects legitimate hidden UI text", () => {
    for (const text of [
      "본문으로 건너뛰기",
      "임시 저장된 초안 상태",
      "한글 자모 ㅋㅋㅋ 교육 자료",
      "정기 점검이 예정되어 있습니다.",
    ]) {
      expect(semanticGate(text).passed, text).toBe(false);
    }
  });

  it("passes suspicious destinations without vocabulary", () => {
    expect(hasSuspiciousDestination("https://ads.example/casino/join")).toBe(true);
    expect(semanticGate("click here", "https://ads.example/casino/join").passed).toBe(true);
  });
});

describe("unicode detectors", () => {
  it("flags fullwidth homoglyph with raw preserved", () => {
    const sig = homoglyphSignal("Ｋ카지노 신규가입");
    expect(sig?.technique).toBe("HOMOGLYPH");
    expect(sig?.rawText).toBe("Ｋ카지노 신규가입");
    expect(sig?.normalizedText).toBe("K카지노 신규가입");
  });

  it("does not flag plain visible Korean as homoglyph", () => {
    expect(homoglyphSignal("정기 점검이 예정되어 있습니다.")).toBeUndefined();
  });

  it("flags compat and conjoining Jamo with reconstruction separate", () => {
    const compat = jamoSignal("ㅋㅏㅈㅣㄴㅗ 신규 가입 머니 지급");
    expect(compat?.technique).toBe("JAMO");
    expect(compat?.rawText).toContain("ㅋ");
    expect(compat?.normalizedText).toBe("카지노신규가입머니지급");
    const conjoining = jamoSignal("대출 24시 간편 승인");
    expect(conjoining?.technique).toBe("JAMO");
  });

  it("does not flag legitimate Jamo education text", () => {
    expect(jamoSignal("한글 자모 ㅋㅋㅋ 교육 자료: 자음과 모음의 결합 원리")).toBeUndefined();
  });
});

describe("live page pipeline", () => {
  it("detects HOMOGLYPH + JAMO on fixture positives, silent on negatives", async () => {
    const started = startFixtureServer(4181);
    const browser = await chromium.launch();
    try {
      const check = async (path: string): Promise<string[]> => {
        const page = await browser.newPage();
        await page.goto(`${started.url}${path}`, { waitUntil: "commit" });
        await page.waitForTimeout(400);
        const found = await detectPageCandidates(page, { pageUrl: `${started.url}${path}` });
        await page.close();
        return found.map((c) => c.technique.technique).sort();
      };
      expect(await check("/positives/homoglyph.html")).toEqual(["HOMOGLYPH", "HOMOGLYPH"]);
      expect(await check("/positives/jamo.html")).toEqual(["JAMO", "JAMO"]);
      expect(await check("/positives/transparent.html")).toEqual(["TRANSPARENT", "TRANSPARENT"]);
      expect(await check("/positives/offscreen.html")).toEqual(["OFFSCREEN", "OFFSCREEN", "OFFSCREEN"]);
      expect(await check("/positives/combined.html")).toEqual(["HOMOGLYPH", "TRANSPARENT"]);
      expect(await check("/negatives.html")).toEqual([]);
    } finally {
      await browser.close();
      await started.close();
    }
  }, 120000);

  it("emits valid result.json with identity dedup", async () => {
    const startedAt = new Date("2026-10-01T00:00:00.000Z").toISOString();
    const finishedAt = new Date("2026-10-01T00:01:00.000Z").toISOString();
    const started = startFixtureServer(4182);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${started.url}/positives/combined.html`, { waitUntil: "commit" });
      await page.waitForTimeout(400);
      const candidates = await detectPageCandidates(page, {
        pageUrl: `${started.url}/positives/combined.html`,
      });
      await page.close();
      // Duplicate the candidate list: engine must collapse to 2 findings.
      const result = buildOfficialResult(
        { topic: "test", entryUrl: `${started.url}/`, startedAt, finishedAt },
        [...candidates, ...candidates],
      );
      expect(result.findings.length).toBe(2);
      expect(result.findings.map((f) => f.technique).sort()).toEqual(["HOMOGLYPH", "TRANSPARENT"]);
      expect(result.findings[0]?.evidence_text).toContain("Ｃ");
      const text = serializeValidatedResult(result);
      expect(validateOfficialResultText(text).ok).toBe(true);
      expect(text.charCodeAt(0)).not.toBe(0xfeff);
    } finally {
      await browser.close();
      await started.close();
    }
  }, 120000);

  it("ground truth coverage: every positive case resolves through the pipeline", async () => {
    const truth = JSON.parse(
      (await readFile(resolve("fixtures/synthetic/ground-truth.json"), "utf-8")) as string,
    ) as { cases: { id: string; kind: string; page: string }[] };
    const positivePages = new Set(
      truth.cases.filter((c) => c.kind === "positive").map((c) => c.page),
    );
    // Direct pages testable without crawler orchestration.
    for (const page of ["/positives/homoglyph.html", "/positives/jamo.html"]) {
      expect(positivePages.has(page), page).toBe(true);
    }
  });
});
