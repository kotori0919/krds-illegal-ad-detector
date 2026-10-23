import { createServer, connect as requireConnectRaw, type Socket } from "node:net";
import { once } from "node:events";
import { expect, it } from "vitest";
import { createConnectTransport } from "../src/pinned-transport.js";
import { PublicNetworkPolicy, startPublicNetworkProxy } from "../src/public-network.js";
import { ScanDeadline } from "../src/deadline.js";
import { createServer as httpServer, request as httpRequest } from "node:http";
import { createServer as httpsServer } from "node:https";
import { connect as tlsConnect, getCACertificates, setDefaultCACertificates } from "node:tls";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { crawlSite } from "../src/crawl.js";
import { createHash, X509Certificate } from "node:crypto";
import { chromium } from "playwright-core";

async function fixture(reply: (socket: Socket, request: string) => void) {
  const sockets = new Set<Socket>();
  let accepts = 0;
  const closes: Promise<unknown>[] = [];
  const server = createServer((socket) => {
    accepts++; closes.push(once(socket, "close"));
    sockets.add(socket); socket.once("close", () => sockets.delete(socket));
    let received = "";
    socket.on("data", (bytes) => {
      received += bytes.toString();
      if (received.includes("\r\n\r\n")) { socket.removeAllListeners("data"); reply(socket, received); }
    });
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const transport = createConnectTransport({ port: (server.address() as { port: number }).port, username: "user", password: "pass" });
  return { transport, accepts: () => accepts, socketCloses: () => Promise.all(closes), close: async () => { await transport.close(); for (const s of sockets) s.destroy(); server.close(); await once(server, "close"); } };
}
const target = { url: new URL("https://fixture.example"), address: "1.1.1.1", family: 4 as const, port: 443, route: "public" as const };

it.each([target, { ...target, address: "2001:4860:4860::8888", family: 6 as const }])("pins numeric CONNECT authority and preserves trailing payload ($address)", async (destination) => {
  let request = "";
  const f = await fixture((socket, input) => { request = input; socket.write("HTTP/1.1 200 OK\r\n"); setImmediate(() => socket.write("\r\npayload")); });
  try {
    const socket = await f.transport.open(destination, { timeoutMs: 1000 });
    const received = once(socket, "data"); socket.resume();
    const bytes = await received;
    expect(bytes[0].toString()).toBe("payload");
    expect(request.split("\r\n")[0]).toBe(`CONNECT ${destination.family === 6 ? `[${destination.address}]` : destination.address}:443 HTTP/1.1`);
    expect(request).toContain("Proxy-Authorization: Basic dXNlcjpwYXNz\r\n");
    socket.destroy();
  } finally { await f.close(); }
});

it.each(["HTTP/1.1 407 Nope\r\n\r\n", "HTTP/1.1 200 OK\r\nX: " + "x".repeat(16384), ""])('rejects failed/oversized/closed CONNECT (%#)', async (reply) => {
  const f = await fixture((socket) => { if (reply) socket.write(reply); else socket.end(); socket.resume(); });
  try { await expect(f.transport.open(target, { timeoutMs: 1000 })).rejects.toThrow(/CONNECT/); await f.socketCloses(); }
  finally { await f.close(); }
});

it.each(["cancel", "deadline"])("closes the pending tunnel on %s", async (mode) => {
  let closed!: Promise<unknown>;
  const f = await fixture((socket) => { closed = once(socket, "close"); socket.resume(); });
  const controller = new AbortController();
  try {
    const pending = f.transport.open(target, { timeoutMs: mode === "deadline" ? 30 : 1000, signal: controller.signal });
    if (mode === "cancel") setTimeout(() => controller.abort(), 30);
    await expect(pending).rejects.toThrow(/cancel|timeout/);
    await closed;
  } finally { await f.close(); }
});

it("routes fetch and browser HTTP/HTTPS through numeric tunnels with original Host/SNI and verified certificates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-tls-"));
  const openssl = process.platform === "win32"
    ? resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "..", "..", "bin", "openssl.exe")
    : "openssl";
  execFileSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "key"), "-out", join(dir, "cert"), "-days", "1", "-subj", "/CN=fixture.example", "-addext", "subjectAltName=DNS:fixture.example"], { stdio: "ignore" });
  const roots = getCACertificates();
  setDefaultCACertificates([...roots, readFileSync(join(dir, "cert"), "utf8")]);
  let destinationHost: string | undefined;
  let destinationAuth: string | string[] | undefined;
  let tlsServername: string | undefined;
  const handler: import("node:http").RequestListener = (req, res) => {
    destinationHost = req.headers.host; destinationAuth = req.headers["proxy-authorization"];
    if (req.url === "/index.xml") { res.setHeader("Content-Type", "application/xml"); res.end('<urlset><url><loc>http://fixture.example/listed</loc></url></urlset>'); return; }
    if (req.url === "/redirect") { res.writeHead(302, { Location: "http://127.0.0.1/private" }); res.end(); return; }
    res.end("owned response");
  };
  const http = httpServer(handler);
  const https = httpsServer({ key: readFileSync(join(dir, "key")), cert: readFileSync(join(dir, "cert")) }, handler);
  https.on("secureConnection", (socket) => { tlsServername = (socket as typeof socket & { servername?: string }).servername || undefined; });
  http.listen(0, "127.0.0.1"); https.listen(0, "127.0.0.1");
  await Promise.all([once(http, "listening"), once(https, "listening")]);
  const authorities: string[] = [];
  const f = await fixture((socket, request) => {
    const authority = request.split(" ")[1]!; authorities.push(authority);
    const destination = authority.endsWith(":443") ? https : http;
    const upstream = requireConnectRaw({ host: "127.0.0.1", port: (destination.address() as { port: number }).port });
    upstream.once("connect", () => { socket.write("HTTP/1.1 200 OK\r\n\r\n"); socket.pipe(upstream); upstream.pipe(socket); });
    socket.once("close", () => upstream.destroy()); upstream.on("error", () => socket.destroy());
  });
  const policy = new PublicNetworkPolicy(async () => [{ address: "1.1.1.1", family: 4 }], f.transport);
  let browserProxy: Awaited<ReturnType<typeof startPublicNetworkProxy>> | undefined;
  try {
    expect(await (await policy.fetch("http://fixture.example/sitemap.xml")).text()).toBe("owned response");
    expect(await (await policy.fetch("https://fixture.example/")).text()).toBe("owned response");
    expect(authorities.at(-1)).toBe("1.1.1.1:443");
    expect(destinationHost).toBe("fixture.example"); expect(tlsServername).toBe("fixture.example"); expect(destinationAuth).toBeUndefined();
    await expect(policy.fetch("https://wrong.example/")).rejects.toThrow(/certificate|hostname|altname/i);
    browserProxy = await startPublicNetworkProxy(policy, new ScanDeadline(10));
    const proxy = new URL(browserProxy.proxy.server);
    const authorization = `Basic ${Buffer.from(`${browserProxy.proxy.username}:${browserProxy.proxy.password}`).toString("base64")}`;
    const body = await new Promise<string>((resolve, reject) => {
      const request = httpRequest({ host: proxy.hostname, port: proxy.port, path: "http://fixture.example/", headers: { "Proxy-Authorization": authorization } }, (response) => { let data = ""; response.on("data", (chunk) => { data += chunk; }); response.on("end", () => resolve(data)); });
      request.on("error", reject); request.end();
    });
    expect(body).toBe("owned response");
    const tunnel = await new Promise<Socket>((resolve, reject) => {
      const request = httpRequest({ host: proxy.hostname, port: proxy.port, method: "CONNECT", path: "fixture.example:443", headers: { "Proxy-Authorization": authorization } });
      request.on("connect", (response, socket) => { if (response.statusCode === 200) resolve(socket); else reject(new Error(`CONNECT ${response.statusCode}`)); }); request.on("error", reject); request.end();
    });
    const secure = tlsConnect({ socket: tunnel, servername: "fixture.example" });
    await once(secure, "secureConnect"); secure.write("GET / HTTP/1.1\r\nHost: fixture.example\r\nConnection: close\r\n\r\n");
    let response = ""; secure.on("data", (chunk) => { response += chunk; }); await once(secure, "end");
    expect(response).toContain("owned response"); expect(destinationAuth).toBeUndefined();
    // Fixture-only trust pins this temporary key. Independent Node requests
    // above verify ordinary CA trust and hostname rejection without this flag.
    const spki = new X509Certificate(readFileSync(join(dir, "cert"))).publicKey.export({ type: "spki", format: "der" });
    const fingerprint = createHash("sha256").update(spki).digest("base64");
    const browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${fingerprint}`] });
    try {
      const context = await browser.newContext({ proxy: browserProxy.proxy });
      const page = await context.newPage();
      const navigation = await page.goto("https://fixture.example/browser");
      expect(await navigation?.text()).toBe("owned response");
      expect(await page.evaluate(async () => (await fetch("/asset")).text())).toBe("owned response");
      expect(destinationHost).toBe("fixture.example"); expect(tlsServername).toBe("fixture.example"); expect(destinationAuth).toBeUndefined();
    } finally { await browser.close(); }
    await browserProxy.close(); browserProxy = undefined;
    const crawl = await crawlSite({ entryUrl: "http://fixture.example/index.xml", entryKind: "sitemap", networkPolicy: policy,
      publicNetworkOnly: true, settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(crawl.pages.map((page) => [page.finalUrl, page.status])).toEqual([["http://fixture.example/listed", 200]]);
    const beforeRedirect = authorities.length;
    const redirected = await crawlSite({ entryUrl: "http://fixture.example/redirect", networkPolicy: policy,
      publicNetworkOnly: true, settleMs: 0, limits: { maxPages: 1, maxDepth: 0, timeoutSec: 30 } });
    expect(redirected.pages[0]?.issue?.kind).toBe("network-policy");
    expect(authorities.slice(beforeRedirect).every((authority) => authority === "1.1.1.1:80")).toBe(true);
  } finally {
    await browserProxy?.close(); await f.close(); http.closeAllConnections(); https.closeAllConnections();
    await Promise.all([http, https].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    setDefaultCACertificates(roots); rmSync(dir, { recursive: true });
  }
}, 30000);

it.for([
  [{ address: "127.0.0.1", family: 4 }],
  [{ address: "169.254.169.254", family: 4 }],
  [{ address: "1.1.1.1", family: 4 }, { address: "10.0.0.1", family: 4 }],
  [{ address: "192.0.2.1", family: 4 }],
])("rejects non-public or mixed DNS before opening upstream (%#)", async (answers) => {
  let connections = 0;
  const f = await fixture((socket) => { connections++; socket.end("HTTP/1.1 200 OK\r\n\r\n"); });
  try {
    const policy = new PublicNetworkPolicy(async () => answers, f.transport);
    await expect(policy.fetch("http://fixture.example/")).rejects.toThrow(/public network/);
    expect(connections).toBe(0);
    expect(f.accepts()).toBe(0);
  } finally { await f.close(); }
});

it("keeps exact owned origins direct despite an upstream transport", async () => {
  let connections = 0;
  const f = await fixture((socket) => { connections++; socket.end("HTTP/1.1 407 Nope\r\n\r\n"); });
  const server = httpServer((_req, response) => response.end("owned direct"));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    expect(await (await PublicNetworkPolicy.forFixtureOrigins([origin], f.transport).fetch(origin)).text()).toBe("owned direct");
    expect(connections).toBe(0);
    expect(f.accepts()).toBe(0);
  } finally { await f.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

it("does not acknowledge the browser CONNECT when upstream authentication fails", async () => {
  const f = await fixture((socket) => socket.end("HTTP/1.1 407 Authentication Required\r\n\r\n"));
  const policy = new PublicNetworkPolicy(async () => [{ address: "1.1.1.1", family: 4 }], f.transport);
  const boundary = await startPublicNetworkProxy(policy, new ScanDeadline(10));
  try {
    const proxy = new URL(boundary.proxy.server);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest({ host: proxy.hostname, port: proxy.port, method: "CONNECT", path: "fixture.example:443",
        headers: { "Proxy-Authorization": `Basic ${Buffer.from(`${boundary.proxy.username}:${boundary.proxy.password}`).toString("base64")}` } });
      request.on("connect", (response, socket) => { socket.destroy(); resolve(response.statusCode); });
      request.on("error", reject); request.end();
    });
    // An upstream CONNECT rejection is a gateway failure; it is not an SSRF
    // policy denial, so it must not fabricate a network-policy record.
    expect(status).toBe(502); expect(f.accepts()).toBe(1);
  } finally { await boundary.close(); await f.close(); }
});

it("closes established tunnels and rejects new opens after transport shutdown", async () => {
  const f = await fixture((socket) => { socket.write("HTTP/1.1 200 OK\r\n\r\n"); socket.resume(); });
  try {
    const socket = await f.transport.open(target, { timeoutMs: 1000 });
    const closed = once(socket, "close");
    await f.transport.close(); await closed; await f.socketCloses();
    expect(socket.destroyed).toBe(true);
    await expect(f.transport.open(target, { timeoutMs: 1000 })).rejects.toThrow(/cancelled/);
  } finally { await f.close(); }
});

it("closes pending upstream setup promptly when a browser HTTP request disconnects", async () => {
  let received!: (socket: Socket) => void;
  const upstreamReceived = new Promise<Socket>((resolve) => { received = resolve; });
  let replyTimer: ReturnType<typeof setTimeout> | undefined;
  const f = await fixture((socket) => {
    socket.resume(); received(socket);
    replyTimer = setTimeout(() => { if (!socket.destroyed) socket.write("HTTP/1.1 200 OK\r\n\r\n"); }, 80);
  });
  const policy = new PublicNetworkPolicy(async () => [{ address: "1.1.1.1", family: 4 }], f.transport);
  const boundary = await startPublicNetworkProxy(policy, new ScanDeadline(10));
  const proxy = new URL(boundary.proxy.server);
  const browser = requireConnectRaw({ host: proxy.hostname, port: Number(proxy.port) });
  let observationTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await once(browser, "connect");
    const authorization = Buffer.from(`${boundary.proxy.username}:${boundary.proxy.password}`).toString("base64");
    browser.write(`GET http://fixture.example/ HTTP/1.1\r\nHost: fixture.example\r\nProxy-Authorization: Basic ${authorization}\r\n\r\n`);
    const upstream = await upstreamReceived;
    const upstreamClosed = once(upstream, "close").then(() => true);
    browser.destroy();
    const observed = await Promise.race([upstreamClosed, new Promise<boolean>((resolve) => { observationTimer = setTimeout(() => resolve(false), 350); })]);
    expect(observed, "upstream peer must close promptly after browser disconnect").toBe(true);
  } finally {
    clearTimeout(replyTimer); clearTimeout(observationTimer); browser.destroy();
    await boundary.close(); await f.close();
  }
});
