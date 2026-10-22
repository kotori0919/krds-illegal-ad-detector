import { expect, it } from "vitest";
import type { VisualCandidate } from "../src/creative.js";
import { decideVisualImage } from "../src/visual-decision.js";
const candidate: VisualCandidate = { sourceKind:"img",pageUrl:"https://page.example/",frameUrl:"https://page.example/",location:"#ad",destinationUrl:"https://offer.example/",candidateEvidence:["ad-marker","external-destination"],visibleDomAdTexts:[] };
const recognition={state:"available",backend:"actual-numeric-ocr",text:"7474\n1+1 2+2 30+10",confidence:.9} as const;
const image={state:"available",policy:"image-ad-embedding-v1",model:"embeddinggemma-2-image-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",imageSha256:"a".repeat(64),positiveSimilarity:.8,negativeSimilarity:.7,margin:.1,shuffledPositiveSimilarity:.6,shuffledNegativeSimilarity:.7,shuffledMargin:-.1,threshold:0,control:"pixel-shuffle-v1",seed:1701,passed:true,elapsedMs:1} as const;
it("admits a grounded image review without inventing an OCR category",()=>{
 const before=decideVisualImage(candidate,recognition,false);
 expect(before.decision.passed).toBe(false);
 const after=decideVisualImage(candidate,recognition,false,undefined,image);
 expect(after.decision).toMatchObject({rule:"image-only-ad-v5-image-review",passed:true});
 expect(after.gate.matchedTerms).toEqual([]);expect(after.gate.normalizedText).toBe(before.gate.normalizedText);
});
it.each(["public","dom","internal","missing-link"] as const)("keeps the evidence exclusions for image review: %s",state=>{
 const text=state==="public"?"불법 도박 광고 신고 및 예방 안내":recognition.text;
 const input={...candidate,destinationUrl:state==="internal"?candidate.pageUrl:candidate.destinationUrl,candidateEvidence:state==="missing-link"?[]:candidate.candidateEvidence,visibleDomAdTexts:state==="dom"?[text]:[]};
 expect(decideVisualImage(input,{...recognition,text},false,undefined,image).decision.passed).toBe(false);
});
it("does not override a baseline literal positive when image comparison fails",()=>{
 const text={...recognition,text:"카지노 가입 보너스 지급"};
 const before=decideVisualImage(candidate,text,false);expect(before.decision.passed).toBe(true);
 expect(decideVisualImage(candidate,text,false,undefined,{state:"unavailable",reason:"budget"})).toEqual(before);
});
it("does not promote a style-only image or unavailable analysis",()=>{
 for(const evidence of [{...image,shuffledPositiveSimilarity:.8,shuffledMargin:.1,passed:false},{state:"unavailable",reason:"model-error"}as const])
  expect(decideVisualImage(candidate,recognition,false,undefined,evidence).decision.passed).toBe(false);
});
it("preserves readable course-sale context while still accepting explicit gambling offers",()=>{
 const education={...recognition,text:"개강맞이 3만원 할인 전강의 수강 최신 아이패드 득템 찬스"};
 expect(decideVisualImage(candidate,education,false,undefined,{...image,policy:"image-ad-embedding-v3"}).decision.passed).toBe(false);
 const phone={...recognition,text:"휴대폰 쿠폰 5만원 증정 채널 추가"};
 expect(decideVisualImage(candidate,phone,false,undefined,{...image,policy:"image-ad-embedding-v3"}).decision.passed).toBe(false);
 const gambling={...recognition,text:"강의 무료 제공 카지노 바카라 첫충 40% 가입 입금 보너스"};
 expect(decideVisualImage(candidate,gambling,false,undefined,image).decision.passed).toBe(true);
});
