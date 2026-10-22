import { createServer } from "node:http";
import { expect, it, onTestFailed } from "vitest";
import { scanSite } from "../src/scan.js";
import { validateOfficialResultText } from "@krds-detector/contracts";

it("keeps an owned page direct while rejecting its public resource through the session transport", async()=>{
  let opens=0;
  const server=createServer((_request,response)=>{response.setHeader("content-type","text/html");response.end('<img src="http://1.1.1.1/owned-fixture-never-direct.png"><p>fixture</p>');});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=(server.address() as {port:number}).port;
  try{
    const output=await scanSite({entryUrl:`http://127.0.0.1:${port}/`,crawl:{settleMs:0,limits:{maxPages:1,maxDepth:0,timeoutSec:10},
      publicTransport:{open:async()=>{opens++;throw new Error("public transport deliberately unavailable");},close:async()=>{}}}});
    expect(opens).toBeGreaterThan(0);
    expect(output.detailBundle.coverage.checkedPages).toBe(1);
    expect(output.detailBundle.pageOutcomes?.[0]?.outcome).toBe("checked");
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},15_000);

it("preserves completed findings and page outcomes when cancelled during another navigation", async () => {
  const controller = new AbortController();
  const startedAt = performance.now();
  const phases: { phase: string; elapsedMs: number }[] = [];
  const record = (phase: string): void => {
    phases.push({ phase, elapsedMs: Math.round(performance.now() - startedAt) });
    if (phases.length > 16) phases.shift();
  };
  onTestFailed(() => {
    throw new Error(`Cancellation fixture trace: ${JSON.stringify(phases)}`);
  });
  let cancelledAt: number | undefined;
  const server = createServer((request, response) => {
    if (request.url === "/slow") { record("abort-requested"); cancelledAt = performance.now(); controller.abort(); return; }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end('<p id="offer" style="opacity:0">카지노 가입 보너스 지급</p><a href="/slow">next</a>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture address unavailable");
  try {
    record("scan-started");
    const output = await scanSite({ entryUrl: `http://127.0.0.1:${address.port}/`, signal: controller.signal,
      onEvent: (event) => record(event.kind),
      crawl: { concurrency: 1, settleMs: 0, perPageMs: 1000, limits: { timeoutSec: 20 } } });
    record("scan-returned");
    expect(cancelledAt).toBeDefined();
    expect(performance.now() - cancelledAt!).toBeLessThan(5000);
    expect(output.result.meta.topic).toBe("TOPIC");
    expect(output.result.findings.map((finding) => finding.evidence_text)).toEqual(["카지노 가입 보너스 지급"]);
    expect(output.detailBundle.coverage.cancelled).toBe(true);
    expect(output.detailBundle.pageOutcomes?.map((page) => page.outcome)).toEqual(["checked", "failed"]);
    expect(validateOfficialResultText(output.json).ok).toBe(true);
  } finally {
    record("fixture-close-started");
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeAllConnections();
    await closed;
    record("fixture-closed");
  }
  // Bounds: each navigation has perPageMs: 1000 inside a 20 s whole-scan
  // deadline, and the harness timeout below is a deliberate 2x backstop over
  // that deadline. Cancellation is asserted by settlement, so a genuine
  // cancellation hang must fail here rather than hang the CI job.
}, 40_000);
