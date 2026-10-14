import { connect, type Socket } from "node:net";
import { PUBLIC_NETWORK_LIMITS, type PinnedTarget } from "./public-network.js";

export interface PinnedTransport {
  open(target: PinnedTarget, options: { signal?: AbortSignal; timeoutMs: number }): Promise<Socket>;
  close(): Promise<void>;
}

function transport(proxy?: { port: number; username: string; password: string }): PinnedTransport {
  const sockets = new Set<Socket>();
  let closed = false;
  return {
    open(target, { signal, timeoutMs }) {
      if (closed || signal?.aborted || timeoutMs <= 0) return Promise.reject(new Error("transport cancelled"));
      if (sockets.size >= PUBLIC_NETWORK_LIMITS.sockets) return Promise.reject(new Error("transport socket limit"));
      return new Promise<Socket>((resolve, reject) => {
        const socket = connect(proxy ? { host: "127.0.0.1", port: proxy.port } : { host: target.address, port: target.port, family: target.family });
        sockets.add(socket); socket.once("close", () => sockets.delete(socket));
        let settled = false;
        const header = proxy ? Buffer.allocUnsafe(PUBLIC_NETWORK_LIMITS.headerBytes) : undefined;
        let headerLength = 0;
        const timer = setTimeout(() => finish(new Error("transport timeout")), timeoutMs);
        const abort = (): void => { if (settled) socket.destroy(); else finish(new Error("transport cancelled")); };
        const error = (): void => finish(new Error("CONNECT transport failed"));
        const close = (): void => finish(new Error("CONNECT closed before response"));
        const finish = (failure?: Error): void => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          socket.removeListener("data", data); socket.removeListener("error", error); socket.removeListener("close", close);
          if (failure) { signal?.removeEventListener("abort", abort); socket.destroy(); reject(failure); }
          else {
            socket.once("close", () => signal?.removeEventListener("abort", abort));
            socket.setTimeout(PUBLIC_NETWORK_LIMITS.socketIdleMs, () => socket.destroy());
            resolve(socket);
          }
        };
        const data = (bytes: Buffer): void => {
          const copied = bytes.copy(header!, headerLength, 0, header!.length - headerLength);
          const searchStart = Math.max(0, headerLength - 3);
          headerLength += copied;
          const end = header!.subarray(0, headerLength).indexOf("\r\n\r\n", searchStart);
          if (end < 0) {
            if (headerLength === header!.length) finish(new Error("CONNECT response headers too large"));
            return;
          }
          if (!/^HTTP\/1\.[01] 200(?: |\r\n)/.test(header!.subarray(0, end + 2).toString("latin1"))) { finish(new Error("CONNECT rejected")); return; }
          socket.pause();
          if (copied < bytes.length) socket.unshift(bytes.subarray(copied));
          const payload = header!.subarray(end + 4, headerLength);
          if (payload.length) socket.unshift(payload);
          finish();
        };
        socket.on("error", error); socket.once("close", close);
        signal?.addEventListener("abort", abort, { once: true });
        socket.once("connect", () => {
          if (!proxy) { finish(); return; }
          socket.on("data", data);
          const authority = `${target.family === 6 ? `[${target.address}]` : target.address}:${target.port}`;
          socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\nProxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}\r\n\r\n`);
        });
      });
    },
    async close() { closed = true; await Promise.all([...sockets].map((socket) => new Promise<void>((resolve) => { socket.once("close", resolve); socket.destroy(); }))); },
  };
}

export function createDirectTransport(): PinnedTransport { return transport(); }
export function createConnectTransport(proxy: { port: number; username: string; password: string }): PinnedTransport {
  if (!Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535) throw new Error("invalid CONNECT proxy port");
  return transport({ ...proxy });
}
