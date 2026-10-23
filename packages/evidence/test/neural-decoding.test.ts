import { expect, it } from "vitest";
import { decodeText } from "../src/neural-ocr.js";

it("retains CTC blank/repeat handling, lowest-index ties and confidence", () => {
  const data = Float32Array.from([0.1,0.8,0.1, 0.1,0.7,0.2, 1,0,0, 0.1,0.6,0.6, 0.1,0.2,0.9]);
  const result = decodeText(data, 5, ["blank", "가", "입"]);
  expect(result.text).toBe("가가입");
  expect(result.confidence).toBe((data[1]! + data[10]! + data[14]!) / 3);
});

it("rejects invalid non-winning or blank probabilities in every step", () => {
  for (const position of [0,1,2,3,4,5]) {
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -0.001, 1.01]) {
      const data = Float32Array.from([0.1,0.8,0.1, 0.1,0.2,0.9]);
      data[position] = invalid;
      expect(() => decodeText(data,2,["blank","가","입"])).toThrow("Neural OCR model output is invalid");
    }
  }
  expect(decodeText(Float32Array.from([0,1+1e-7,-1e-7]),1,["blank","가","입"])).toEqual({text:"가",confidence:1});
});
