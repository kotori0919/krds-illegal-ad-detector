import { randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { Agent as HttpAgent, createServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { isIP, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { createDirectTransport, type PinnedTransport } from "./pinned-transport.js";
import { Readable } from "node:stream";
import type { ScanDeadline } from "./deadline.js";

export const PUBLIC_NETWORK_LIMITS = Object.freeze({ sockets: 64, dnsAnswers: 32, dnsMs: 2000, socketIdleMs: 20000, headerBytes: 16384 });
interface Address { address: string; family: number }
type Resolver = (hostname: string) => Promise<Address[]>;
export interface PinnedTarget { url: URL; address: string; family: 4 | 6; port: number; route: "public" | "owned-origin" }

function denied(): Error { return new Error("public network policy rejected target"); }

/** Conservative global-unicast policy; mapped/tunnel/reserved forms are denied. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number) as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99)))
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113)) return false;
    return true;
  }
  if (family !== 6 || address.includes("%")) return false;
  const pieces = address.toLowerCase().split(":");
  const first = Number.parseInt(pieces[0] ?? "", 16);
  const second = Number.parseInt(pieces[1] || "0", 16);
  // 2000::/3 only, excluding transition/documentation/special-purpose ranges.
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff
    && !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
}

function bounded<T>(operation: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => finish(new Error("public network operation cancelled"));
    const timer = setTimeout(() => finish(new Error("public network DNS timeout")), timeoutMs);
    const finish = (error?: Error, value?: T): void => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(value as T);
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    void operation.then((value) => finish(undefined, value), (error: unknown) => finish(error instanceof Error ? error : denied()));
  });
}

export class PublicNetworkPolicy {
  private readonly directTransport = createDirectTransport();
  private pinnedOrigins = new Map<string, { address: string; family: 4 | 6 }>();

  /** Resolver injection is trusted test code; no UI/worker argument exposes it. */
  constructor(private readonly resolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true }), private readonly publicTransport?: PinnedTransport) {}

  /** A manually entered evaluator target authorizes exactly its origin,
   * pinned for this scan. Public targets never gain a private-DNS exception.
   * Other origins still pass public-only DNS checks at every new socket.
   */
  static async forManualEntry(raw: string, signal?: AbortSignal, timeoutMs: number = PUBLIC_NETWORK_LIMITS.dnsMs, publicTransport?: PinnedTransport): Promise<PublicNetworkPolicy> {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || timeoutMs <= 0 || signal?.aborted) throw denied();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const policy = new PublicNetworkPolicy(undefined, publicTransport);
    const answers = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await bounded(policy.resolver(hostname), Math.min(timeoutMs, PUBLIC_NETWORK_LIMITS.dnsMs), signal);
    const evaluationAddress = (address: string): boolean => {
      if (isPublicAddress(address)) return true;
      if (isIP(address) === 4) {
        const [a,b] = address.split(".").map(Number);
        return a === 127 || a === 10 || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && b === 168);
      }
      return address === "::1" || (isIP(address) === 6 && /^f[cd][0-9a-f]{2}:/i.test(address));
    };
    if (!answers.length || answers.length > PUBLIC_NETWORK_LIMITS.dnsAnswers
      || answers.some((answer) => isIP(answer.address) !== answer.family || !evaluationAddress(answer.address))) throw denied();
    // Public entry DNS continues to revalidate normally. A private evaluator
    // entry pins one exact initial address, never an entire subnet or hostname
    // wildcard. Metadata/link-local/multicast/reserved targets remain rejected.
    if (answers.some((answer) => !isPublicAddress(answer.address))) {
      if (answers.some((answer) => isPublicAddress(answer.address))) throw denied();
      answers.sort((a,b)=>a.family-b.family || a.address.localeCompare(b.address));
      const selected = answers[0]!;
      policy.pinnedOrigins.set(url.origin, { address: selected.address, family: selected.family as 4 | 6 });
    }
    return policy;
  }

  /** Exact owned loopback origins only. Not serialized or accepted by the CLI. */
  static forFixtureOrigins(origins: readonly string[], publicTransport?: PinnedTransport): PublicNetworkPolicy {
    const bindings: { origin: string; address: "127.0.0.1" | "::1" }[] = [];
    for (const raw of origins) {
      const url = new URL(raw);
      if (!["127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("fixture policy requires an exact owned loopback origin and port");
      bindings.push({ origin: raw, address: url.hostname === "[::1]" ? "::1" : "127.0.0.1" });
    }
    return PublicNetworkPolicy.forFixtureTargets(bindings, publicTransport);
  }

  static forFixtureTargets(bindings: readonly { origin: string; address: "127.0.0.1" | "::1" }[], publicTransport?: PinnedTransport): PublicNetworkPolicy {
    const policy = new PublicNetworkPolicy(undefined, publicTransport);
    for (const binding of bindings) {
      const url = new URL(binding.origin);
      if (!["http:", "https:"].includes(url.protocol) || !url.port || url.username || url.password
        || url.pathname !== "/" || url.search || url.hash || !["127.0.0.1", "::1"].includes(binding.address)) throw new Error("fixture policy requires an exact owned origin and loopback address");
      policy.pinnedOrigins.set(url.origin, { address: binding.address, family: binding.address === "::1" ? 6 : 4 });
    }
    return policy;
  }

  async resolveTarget(raw: string, signal?: AbortSignal, timeoutMs: number = PUBLIC_NETWORK_LIMITS.dnsMs): Promise<PinnedTarget> {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw denied();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    if (port < 1 || port > 65535 || timeoutMs <= 0 || signal?.aborted) throw denied();
    const pinned = this.pinnedOrigins.get(url.origin);
    if (pinned) return { url, ...pinned, port, route: "owned-origin" };
    if (/^(?:localhost|metadata\.google\.internal)$/i.test(hostname) || /\.(?:localhost|local|internal)$/i.test(hostname)) throw denied();
    const answers = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await bounded(this.resolver(hostname), Math.min(timeoutMs, PUBLIC_NETWORK_LIMITS.dnsMs), signal);
    if (!answers.length || answers.length > PUBLIC_NETWORK_LIMITS.dnsAnswers
      || answers.some((answer) => !isPublicAddress(answer.address) || isIP(answer.address) !== answer.family)) throw denied();
    answers.sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
    return { url, address: answers[0]!.address, family: answers[0]!.family as 4 | 6, port, route: "public" };
  }

  openTarget(target: PinnedTarget, options: { signal?: AbortSignal; timeoutMs: number }): Promise<Socket> {
    return (target.route === "owned-origin" ? this.directTransport : this.publicTransport ?? this.directTransport).open(target, options);
  }

  /** Manual redirects, no pool reuse or second DNS lookup, normal TLS validation. */
  async fetch(raw: string, options: { signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<Response> {
    const target = await this.resolveTarget(raw, options.signal);
    const connection = await connectedAgent(this, target, { signal: options.signal, timeoutMs: PUBLIC_NETWORK_LIMITS.socketIdleMs });
    const { agent } = connection;
    return new Promise<Response>((resolve, reject) => {
      const transport = target.url.protocol === "https:" ? httpsRequest : httpRequest;
      const request = transport(target.url, { agent, signal: options.signal,
        headers: { ...options.headers, "accept-encoding": "identity" }, maxHeaderSize: PUBLIC_NETWORK_LIMITS.headerBytes }, (response) => {
        response.once("close", connection.destroy);
        const status = response.statusCode ?? 502;
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const body = [204, 205, 304].includes(status) ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>;
        try { resolve(new Response(body, { status, headers })); } catch (error) { response.destroy(); reject(error); }
      });
      request.setTimeout(PUBLIC_NETWORK_LIMITS.socketIdleMs, () => request.destroy(new Error("public network request timeout")));
      request.on("error", (error) => { connection.destroy(); reject(error); });
      request.end();
    });
  }
}

async function connectedAgent(policy: Pick<PublicNetworkPolicy, "openTarget">, target: PinnedTarget,
  options: { signal?: AbortSignal; timeoutMs: number }): Promise<{ agent: HttpAgent | HttpsAgent; destroy: () => void }> {
  const socket = await policy.openTarget(target, options);
  const secure = target.url.protocol === "https:";
  const agent = secure ? new HttpsAgent({ keepAlive: false }) : new HttpAgent({ keepAlive: false });
  agent.createConnection = () => {
    if (secure) return tlsConnect({ socket, servername: target.url.hostname.replace(/^\[|\]$/g, "") });
    socket.resume(); return socket;
  };
  // The socket is already open before an HTTP request takes it from the agent.
  // Keep explicit ownership so abandonment before createConnection also closes it.
  return { agent, destroy: () => { socket.destroy(); agent.destroy(); } };
}

export type PublicNetworkBoundary = Pick<PublicNetworkPolicy, "resolveTarget" | "fetch" | "openTarget">;

function forwardHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const result = { ...headers };
  const nominated = String(headers.connection ?? "").split(",").map((value) => value.trim().toLowerCase());
  for (const key of ["connection", "proxy-connection", "proxy-authorization", "proxy-authenticate", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", ...nominated]) delete result[key];
  return result;
}

export interface PublicNetworkProxy {
  proxy: { server: string; username: string; password: string; bypass: string };
  close: () => Promise<void>;
}

/** Authenticated loopback HTTP/CONNECT proxy; every new upstream socket is pinned. */
export async function startPublicNetworkProxy(policy: PublicNetworkBoundary, deadline: ScanDeadline, signal?: AbortSignal,
  onDenied?: (url: string) => void): Promise<PublicNetworkProxy> {
  const username = randomBytes(16).toString("hex");
  const password = randomBytes(32).toString("hex");
  const expectedAuth = Buffer.from(`Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
  const sockets = new Set<Socket>();
  const controller = new AbortController();
  let closed = false;
  const authenticate = (header: string | undefined): boolean => {
    const actual = Buffer.from(header ?? "");
    return actual.length === expectedAuth.length && timingSafeEqual(actual, expectedAuth);
  };
  const track = (socket: Socket): boolean => {
    if (closed || sockets.size >= PUBLIC_NETWORK_LIMITS.sockets) { socket.destroy(); return false; }
    sockets.add(socket);
    socket.setTimeout(Math.min(PUBLIC_NETWORK_LIMITS.socketIdleMs, Math.max(1, deadline.operationTimeoutMs(PUBLIC_NETWORK_LIMITS.socketIdleMs))), () => socket.destroy());
    socket.once("close", () => sockets.delete(socket));
    return true;
  };
  const server = createServer({ maxHeaderSize: PUBLIC_NETWORK_LIMITS.headerBytes }, (request, response) => {
    if (!authenticate(request.headers["proxy-authorization"])) {
      response.writeHead(407, { "Proxy-Authenticate": 'Basic realm="KrdsDetector"', Connection: "close" }); response.end(); return;
    }
    const requestController = new AbortController();
    const abortRequest = (): void => requestController.abort();
    controller.signal.addEventListener("abort", abortRequest, { once: true });
    response.once("close", () => {
      abortRequest(); controller.signal.removeEventListener("abort", abortRequest);
    });
    if (controller.signal.aborted) abortRequest();
    void (async () => {
      try {
        if (closed || !deadline.canStartPage(0)) throw denied();
        const target = await policy.resolveTarget(request.url ?? "", requestController.signal, deadline.operationTimeoutMs(PUBLIC_NETWORK_LIMITS.dnsMs));
        if (target.url.protocol !== "http:" || closed || request.destroyed) throw denied();
        const headers = forwardHeaders(request.headers);
        headers.host = target.url.host;
        headers.connection = "close";
        const connection = await connectedAgent(policy, target, { signal: requestController.signal, timeoutMs: deadline.operationTimeoutMs(PUBLIC_NETWORK_LIMITS.socketIdleMs) });
        if (closed || response.destroyed) { connection.destroy(); return; }
        const { agent } = connection;
        const upstream = httpRequest(target.url, { agent, method: request.method, headers,
          signal: requestController.signal, maxHeaderSize: PUBLIC_NETWORK_LIMITS.headerBytes }, (incoming) => {
          response.writeHead(incoming.statusCode ?? 502, forwardHeaders(incoming.headers));
          incoming.on("error", () => response.destroy());
          incoming.pipe(response);
        });
        upstream.on("socket", (socket) => { track(socket); });
        upstream.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end(); });
        response.once("close", () => { upstream.destroy(); connection.destroy(); });
        request.pipe(upstream);
      } catch {
        if (response.destroyed || requestController.signal.aborted) return;
        onDenied?.(request.url ?? ""); if (!response.headersSent) response.writeHead(403, { Connection: "close" }); response.end("public network policy rejected target");
      }
    })();
  });
  server.on("connection", track);
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("upgrade", (_request, socket) => socket.destroy());
  server.on("connect", (request, client, head) => {
    if (!authenticate(request.headers["proxy-authorization"])) {
      client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="KrdsDetector"\r\nConnection: close\r\n\r\n'); return;
    }
    void (async () => {
      try {
        if (closed || !deadline.canStartPage(0)) throw denied();
        const target = await policy.resolveTarget(`https://${request.url ?? ""}`, controller.signal, deadline.operationTimeoutMs(PUBLIC_NETWORK_LIMITS.dnsMs));
        if (target.url.pathname !== "/" || target.url.search || target.url.hash || closed || client.destroyed) throw denied();
        const upstream = await policy.openTarget(target, { signal: controller.signal, timeoutMs: deadline.operationTimeoutMs(PUBLIC_NETWORK_LIMITS.socketIdleMs) });
        if (!track(upstream)) { client.destroy(); return; }
        upstream.on("error", () => client.destroy());
        client.on("error", () => upstream.destroy());
        upstream.once("close", () => client.destroy());
        client.once("close", () => upstream.destroy());
        if (closed || client.destroyed) { upstream.destroy(); return; }
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(client); client.pipe(upstream);
      } catch { onDenied?.(`https://${request.url ?? ""}`); client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); }
    })();
  });
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= new Promise<void>((resolve) => {
      closed = true; controller.abort(); signal?.removeEventListener("abort", abort);
      clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      server.close(() => resolve());
    });
    return closing;
  };
  const abort = (): void => { void close(); };
  const timer = setTimeout(abort, Math.max(1, deadline.operationTimeoutMs(deadline.remainingMs())));
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) await close();
  const address = server.address();
  if (!address || typeof address === "string") { await close(); throw new Error("public network proxy unavailable"); }
  return { proxy: { server: `http://127.0.0.1:${address.port}`, username, password, bypass: "<-loopback>" }, close };
}
