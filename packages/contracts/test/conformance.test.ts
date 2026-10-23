import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateOfficialResult } from "../src/result.js";

const corpus: {valid: unknown; invalid: {name:string;path:(string|number)[];value:unknown}[]} = JSON.parse(readFileSync(new URL("./fixtures/official-conformance.json",import.meta.url),"utf8"));
it("accepts the shared native/worker official contract fixture",()=>{expect(validateOfficialResult(corpus.valid).ok).toBe(true);});
it.each(corpus.invalid)("rejects shared contract boundary: $name",sample=>{
  const value=structuredClone(corpus.valid);
  let target=value as Record<string|number,unknown>;
  for(const key of sample.path.slice(0,-1)) target=target[key] as Record<string|number,unknown>;
  target[sample.path.at(-1)!]=sample.value;
  expect(validateOfficialResult(value).ok).toBe(false);
});
