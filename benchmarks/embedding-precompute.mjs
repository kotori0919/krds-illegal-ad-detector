import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fork, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { PNG } from "pngjs";
import { performance } from "node:perf_hooks";
import { build } from "esbuild";

const base = process.env.EMBEDDING_BENCH_DIR ?? "artifacts/embedding-precompute-20261022";
const inputs = JSON.parse(await readFile(`${base}/inputs.json`, "utf8"));
const protocol = JSON.parse(await readFile(`${base}/protocol.json`, "utf8"));
const groups = Object.groupBy(inputs, row => row.group);
const external = ["playwright-core", "fast-xml-parser", "onnxruntime-node", "tesseract.js", "pngjs", "exceljs", "fflate", "@huggingface/tokenizers"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
assert.equal(digest(await readFile(`${base}/inputs.json`)), protocol.inputsSha256);

async function freeze(variant, profile) {
  const target = `${base}/${variant}${profile ? "-profile" : "-runtime"}`;
  assert.ok(!existsSync(`${target}/identity.json`), `Refusing to overwrite frozen runtime ${target}`);
  await mkdir(target, { recursive: true });
  if (profile) await cp(`${base}/${variant}-runtime/scan.mjs`, `${target}/scan.mjs`);
  else await build({ entryPoints: ["packages/detection/dist/scan.js"], bundle: true, platform: "node", format: "esm", external, outfile: `${target}/scan.mjs` });
  if (profile) {
    const profiler = resolve("benchmarks/embedding-stage-profiler.mjs");
    const plugin = { name: "diagnostic-stage-spans", setup(builder) {
      builder.onLoad({ filter: /\/(text-embedding|ocr-worker|neural-ocr)\.ts$/ }, async args => {
        const name = args.path.split("/").at(-1);
        let source = await readFile(variant === "before" ? `${base}/before-source/${name}` : args.path, "utf8");
        const replace = (from, to) => { assert.ok(source.includes(from), `Missing instrumentation anchor: ${from}`); source = source.replace(from, to); };
        if (name === "text-embedding.ts") {
          replace('const config = JSON.parse(await readFile', 'const tokenizerStarted = performance.now();\n  const config = JSON.parse(await readFile');
          replace('const session = await ort.InferenceSession.create', 'recordStage("gemma.tokenizer", tokenizerStarted);\n  const modelStarted = performance.now();\n  const session = await ort.InferenceSession.create');
          replace('const encode = async', 'recordStage("gemma.session", modelStarted);\n  const encode = async');
          replace('await session.run(feeds, ["sentence_embedding"])', 'await profileAsync(image ? "gemma.image-text-forward" : "gemma.text-forward", () => session.run(feeds, ["sentence_embedding"]))');
          if (source.includes("const references: number[][] = [];")) {
            replace('const references: number[][] = [];', 'const referencesStarted = performance.now();\n  const references: number[][] = [];');
            replace('const classify =', 'recordStage("gemma.references", referencesStarted);\n  const classify =');
          } else {
            replace('const references = await loadTextReferences(directory);', 'const references = await profileAsync("gemma.references-load", () => loadTextReferences(directory));');
          }
          const visionLine = source.match(/vision \?\?= ort\.InferenceSession\.create[^\n]+;/)?.[0];
          assert.ok(visionLine, "Missing vision session anchor");
          replace(visionLine, `vision ??= profileAsync("gemma.vision-session", () => ${visionLine.slice("vision ??= ".length, -1)});`);
          replace('const prepared = preprocessPng(source, shuffled);', 'const prepared = profileSync("gemma.image-preprocess", () => preprocessPng(source, shuffled));');
          replace('output = await engine.run(', 'recordValue("gemma.vision-input", { shuffled, dims: pixel.dims, patches: prepared.softTokens * 9, validPixelsSha256: createHash("sha256").update(Buffer.from(prepared.pixelValues.subarray(0, prepared.softTokens * 9 * 768).buffer, 0, prepared.softTokens * 9 * 768 * 4)).digest("hex"), validPositionsSha256: createHash("sha256").update(Buffer.from(prepared.positions.buffer, 0, prepared.softTokens * 9 * 2 * 8)).digest("hex"), paddingOnly: prepared.pixelValues.subarray(prepared.softTokens * 9 * 768).every(value => value === 0) && prepared.positions.subarray(prepared.softTokens * 9 * 2).every(value => value === -1n) });\n        output = await engine.run(');
          replace('await engine.run({ pixel_values: pixel, pixel_position_ids: positions })', 'await profileAsync("gemma.vision-forward", () => engine.run({ pixel_values: pixel, pixel_position_ids: positions }))');
        } else if (name === "ocr-worker.ts") {
          replace('const engine = (async () => {', 'const engineStarted = performance.now();\nconst engine = (async () => {');
          replace('return worker;', 'recordStage("ocr.tesseract-init", engineStarted);\n  return worker;');
          replace('await worker.recognize(bytes)', 'await profileAsync("ocr.tesseract-forward", () => worker.recognize(bytes))');
          replace('await (await neural).recognize(bytes, input.variant === "small-banner" ? 4 : undefined)', 'await profileAsync("ocr.neural-recognize", async () => (await neural).recognize(bytes, input.variant === "small-banner" ? 4 : undefined))');
          replace('await (await neural).recognize(bytes)', 'await profileAsync("ocr.neural-recognize", async () => (await neural).recognize(bytes))');
        } else {
          replace('const [detectorBytes, recognizerBytes, vocabulary] = await Promise.all', 'const modelsStarted = performance.now();\n  const [detectorBytes, recognizerBytes, vocabulary] = await Promise.all');
          replace('let closed = false;', 'recordStage("ocr.neural-init", modelsStarted);\n  let closed = false;');
          replace('await detector.run({ [detector.inputNames[0]]: input })', 'await profileAsync("ocr.detector-forward", () => detector.run({ [detector.inputNames[0]]: input }))');
          replace('await recognizer.run({ [recognizer.inputNames[0]]: lineInput })', 'await profileAsync("ocr.recognizer-forward", () => recognizer.run({ [recognizer.inputNames[0]]: lineInput }))');
          for (const name of ["imageTensor", "probabilities", "textRegions", "decodeText"]) {
            replace(`function ${name}(`, `function ${name}Impl(`);
            source += `\nconst ${name} = (...args: Parameters<typeof ${name}Impl>) => profileSync("ocr.${name}", () => ${name}Impl(...args));\n`;
          }
          const recognizedAssignment = source.includes('const recognized = await') ? 'const recognized = await' : 'recognized = await';
          replace(recognizedAssignment, `recordValue("ocr.recognizer-input", { dims: lineInput.dims, sha256: createHash("sha256").update(Buffer.from((lineInput.data as Float32Array).buffer)).digest("hex") });\n      ${recognizedAssignment}`);
        }
        return { contents: `import { recordStage, recordValue, profileAsync, profileSync } from ${JSON.stringify(profiler)};\n${source}`, loader: "ts", resolveDir: resolve("packages/evidence/src") };
      });
    } };
    await build({ entryPoints: ["packages/evidence/src/ocr-worker.ts"], bundle: true, platform: "node", format: "esm", external, plugins: [plugin], outfile: `${target}/ocr-worker.mjs` });
  } else await cp("packages/evidence/dist/ocr-worker.mjs", `${target}/ocr-worker.mjs`);
  for (const name of ["ocr-data", "text-embedding-data"]) {
    const link = `${target}/${name}`;
    if (!existsSync(link)) await symlink(await realpath(`packages/evidence/dist/${name}`), link);
  }
  const hashes = {};
  for (const name of ["scan.mjs", "ocr-worker.mjs"]) hashes[name] = digest(await readFile(`${target}/${name}`));
  await writeFile(`${target}/identity.json`, JSON.stringify(hashes, null, 2) + "\n");
}

async function scan(variant, group, repetition, output, profile) {
  const { chromium } = await import("playwright-core");
  const { validateScanDetailBundle } = await import("../packages/contracts/dist/index.js");
  const { scanSite } = await import(pathToFileURL(resolve(`${base}/${variant}${profile ? "-profile" : "-runtime"}/scan.mjs`)).href);
  const rows = groups[group];
  const assets = new Map();
  for (const item of rows) {
    const bytes = await readFile(item.path);
    assert.equal(digest(bytes), item.inputSha256);
    if (!item.width || !item.height) {
      if (bytes.subarray(1, 4).toString() === "PNG") { item.width = bytes.readUInt32BE(16); item.height = bytes.readUInt32BE(20); }
      else if (bytes.subarray(0, 3).toString() === "GIF") { item.width = bytes.readUInt16LE(6); item.height = bytes.readUInt16LE(8); }
    }
    assert.ok(item.width > 0 && item.height > 0, item.id);
    assets.set(`/assets/${item.id}`, { bytes, mediaType: item.mediaType ?? (item.path.endsWith(".jpg") ? "image/jpeg" : "image/png") });
  }
  const server = createServer((req, res) => {
    const asset = assets.get(req.url);
    if (asset) { res.writeHead(200, { "content-type": asset.mediaType, "content-length": asset.bytes.length }); res.end(asset.bytes); }
    else if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html;charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><style>a,img{display:block}</style>${rows.map(row => `<a href="https://observed-offer.example/"><img class="banner" id="${row.id}" width="${row.width}" height="${row.height}" src="/assets/${row.id}"></a>`).join("")}`);
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  assert.equal(process.env.KRDS_TEST_UNSANDBOXED, "1", "Only owned loopback fixtures may use the sandbox exception");
  const launch = chromium.launch.bind(chromium);
  chromium.launch = options => launch({ ...options, chromiumSandbox: false });
  try {
    let committed, officialAtMs;
    const started = performance.now();
    const result = await scanSite({ entryUrl: `http://127.0.0.1:${server.address().port}/`, commitOfficial: json => { committed = json; officialAtMs = performance.now() - started; }, crawl: { concurrency: 1, settleMs: 20, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 180 } } });
    const elapsedMs = performance.now() - started;
    assert.deepEqual(validateScanDetailBundle(result.detailBundle, result.result, result.extraResult), { ok: true, errors: [] });
    assert.equal(result.json, committed); assert.equal(result.result.findings.length, 0);
    const assetIdentities = Object.fromEntries((result.detailBundle.visualAssets ?? []).map(asset => {
      const bytes = Buffer.from(asset.dataUrl.split(",", 2)[1], "base64");
      const identity = { sha256: digest(bytes) };
      if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
        const image = PNG.sync.read(bytes, { checkCRC: true });
        Object.assign(identity, { rgbaSha256: digest(image.data), width: image.width, height: image.height });
      }
      return [asset.assetId, identity];
    }));
    const incomplete = [];
    const observations = rows.map(item => {
      const analyses = result.detailBundle.imageAnalysis.filter(row => row.location === `#${item.id}`);
      if (!(analyses.length > 0 && analyses.every(row => row.ocr.state === "available"))) incomplete.push(item.id);
      for (const row of analyses) {
        for (const alt of row.ocrAlternatives ?? []) assert.equal(alt.state, "available");
        for (const key of ["textEmbedding", "visualEmbedding"]) if (row[key]) assert.equal(row[key].state, "available");
      }
      return { id: item.id, inputSha256: item.inputSha256, kind: item.kind, expectedFrame: item.expectedFrame,
        detected: analyses.some(row => row.decision.passed && (item.expectedFrame === undefined || row.animationFrame?.index === item.expectedFrame)), analyses };
    });
    await writeFile(output, JSON.stringify({ variant, group, repetition, profile, elapsedMs, officialAtMs,
      postOfficialMs: elapsedMs - officialAtMs, assetIdentities, rows: observations, analysisIssues: result.detailBundle.analysisIssues,
      coverage: result.detailBundle.visualAnalysisCoverage, officialCommittedByteIdentical: committed === result.json,
      officialJsonSha256: digest(result.json), official: result.result, extra: result.extraResult }, null, 2) + "\n");
    assert.deepEqual(incomplete, [], "Incomplete acquisitions/OCR must never count as true negatives");
  } finally { chromium.launch = launch; server.closeAllConnections(); await new Promise(done => server.close(done)); }
}

function memoryTree(root) {
  const pending = [root], seen = new Set();
  let rssKiB = 0, workerRssKiB = 0, workerHwmKiB = 0;
  while (pending.length) {
    const pid = pending.pop(); if (seen.has(pid)) continue; seen.add(pid);
    try {
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0); rssKiB += rss;
      if (readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("/ocr-worker.mjs")) {
        workerRssKiB += rss;
        workerHwmKiB = Math.max(workerHwmKiB, Number(status.match(/^VmHWM:\s+(\d+)/m)?.[1] ?? 0));
      }
      const children = readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8").trim();
      if (children) pending.push(...children.split(/\s+/).map(Number));
    } catch (error) { if (!["ENOENT", "ESRCH"].includes(error.code)) throw error; }
  }
  return { rssKiB, workerRssKiB, workerHwmKiB };
}

async function measured(variant, group, repetition, profile = false) {
  const folder = profile ? "profiles" : repetition === 0 ? "warmups" : "runs";
  await mkdir(`${base}/${folder}`, { recursive: true });
  const output = `${base}/${folder}/${group}-${repetition}-${variant}.json`;
  assert.ok(!existsSync(output), `Refusing to overwrite receipt ${output}`);
  const profileFile = resolve(output.replace(/\.json$/, ".ndjson"));
  const args = ["--scan", variant, group, String(repetition), output, ...(profile ? ["--profile"] : [])];
  const env = { ...process.env, EMBEDDING_PROFILE_FILE: profileFile, LC_ALL: "C" };
  const cpuFile = resolve(`${output}.cpu`);
  const child = process.env.EMBEDDING_CPU_TIME === "1"
    ? spawn("/usr/bin/time", ["-f", '{"userSec":%U,"systemSec":%S,"maxRssKiB":%M}', "-o", cpuFile, process.execPath, fileURLToPath(import.meta.url), ...args], { stdio: ["ignore", "pipe", "pipe"], env })
    : fork(fileURLToPath(import.meta.url), args, { stdio: ["ignore", "pipe", "pipe", "ipc"], execArgv: [], env });
  let stderr = ""; child.stderr.on("data", chunk => { stderr += chunk; }); child.stdout.resume();
  const memory = { sampledTreePeakKiB: 0, sampledWorkerPeakKiB: 0, workerHwmKiB: 0, samples: 0, intervalMs: 25 };
  const timer = setInterval(() => {
    const value = memoryTree(child.pid); memory.samples++;
    memory.sampledTreePeakKiB = Math.max(memory.sampledTreePeakKiB, value.rssKiB);
    memory.sampledWorkerPeakKiB = Math.max(memory.sampledWorkerPeakKiB, value.workerRssKiB);
    memory.workerHwmKiB = Math.max(memory.workerHwmKiB, value.workerHwmKiB);
  }, 25);
  const exit = await new Promise(done => child.once("exit", (code, signal) => done({ code, signal })));
  clearInterval(timer);
  await writeFile(`${output}.stderr`, stderr);
  assert.equal(exit.code, 0, JSON.stringify({ output, exit, stderr: stderr.slice(-1500) }));
  const receipt = JSON.parse(await readFile(output, "utf8")); receipt.memory = memory;
  if (process.env.EMBEDDING_CPU_TIME === "1") {
    receipt.cpu = JSON.parse(await readFile(cpuFile, "utf8"));
    receipt.cpu.totalSec = receipt.cpu.userSec + receipt.cpu.systemSec;
  }
  await writeFile(output, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify({ variant, group, repetition, profile, elapsedMs: receipt.elapsedMs,
    detected: receipt.rows.filter(row => row.detected).length, n: receipt.rows.length, memory, cpu: receipt.cpu }));
}

if (process.argv.includes("--scan")) {
  await scan(process.argv[3], process.argv[4], Number(process.argv[5]), process.argv[6], process.argv.includes("--profile"));
  process.exit(0);
} else if (process.argv.includes("--measure")) {
  await measured(process.argv[3], process.argv[4], Number(process.argv[5]));
} else if (process.argv.includes("--freeze")) {
  await freeze(process.argv[3], process.argv.includes("--profile"));
} else if (process.argv.includes("--profile")) {
  for (const group of ["latestPositive", "heldoutNormal"]) await measured(process.argv[3], group, 1, true);
} else {
  const selected = process.env.EMBEDDING_GROUPS?.split(",") ?? Object.keys(groups);
  for (const variant of ["before", "after"]) await measured(variant, "knownMt", 0);
  for (let repetition = 1; repetition <= protocol.repetitions; repetition++) {
    for (const group of repetition === 1 ? selected : selected.filter(name => protocol.timingGroups.includes(name))) {
      for (const variant of repetition % 2 ? ["before", "after"] : ["after", "before"]) await measured(variant, group, repetition);
    }
  }
}
