import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { LocalOcrBackend } from "@krds-detector/evidence";
import { scanSite } from "../src/scan.js";
it.each(["public","dom","logo","education","retail","isolated-number"] as const)("does not override an exclusion in the unused OCR transcript: %s",async mode=>{
 const image=await readFile("fixtures/real-banners/blacktoon-1.png"),text=mode==="public"?"불법 도박 광고 신고 및 예방 안내":mode==="dom"?"카지노 가입 보너스 지급":mode==="education"?"개강맞이 3만원 할인 전강의 수강":mode==="retail"?"휴대폰 쿠폰 5만원 증정":mode==="isolated-number"?"":"MEXX";
 const server=createServer((request,response)=>{response.setHeader("content-type",request.url==="/ad.png"?"image/png":"text/html;charset=utf-8");response.end(request.url==="/ad.png"?image:`<a href="https://offer.example/"><img id="ad" class="banner" width="206" height="62" src="/ad.png"></a>${mode==="dom"?`<p>${text}</p>`:""}`);});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("No fixture address");
 const recognition=vi.spyOn(LocalOcrBackend.prototype,"recognize").mockImplementation(async crop=>({sourceId:"ad",backend:crop.variant?"ppocrv5-korean-mobile-4x-cpu-v2":"ppocrv5-korean-mobile-cpu-v1",text:crop.variant?text:mode==="logo"?"MEXX\nN":mode==="isolated-number"?"2":"7474 30+10",confidence:.8}));
 const visual=vi.spyOn(LocalOcrBackend.prototype,"analyzeImage").mockResolvedValue({state:"available",policy:"image-ad-embedding-v1",model:"embeddinggemma-2-image-text-f32",revision:"daa72c51243991dfcaf9f9137d2c573d8f7790c0",imageSha256:createHash("sha256").update(image).digest("hex"),positiveSimilarity:.8,negativeSimilarity:.7,margin:.1,shuffledPositiveSimilarity:.6,shuffledNegativeSimilarity:.7,shuffledMargin:-.1,threshold:0,control:"pixel-shuffle-v1",seed:1701,passed:true,elapsedMs:1});
 const warm=vi.spyOn(LocalOcrBackend.prototype,"warm").mockResolvedValue(undefined);
 try{const output=await scanSite({entryUrl:`http://127.0.0.1:${address.port}/`,crawl:{settleMs:20,limits:{maxPages:1,maxDepth:0,timeoutSec:60}}});expect(output.detailBundle.imageAnalysis![0]!.decision.passed).toBe(false);expect(visual).not.toHaveBeenCalled();}
 finally{recognition.mockRestore();visual.mockRestore();warm.mockRestore();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},15000);
