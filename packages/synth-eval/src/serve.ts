import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

export function fixtureRoot(): string {
  return resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "fixtures", "synthetic");
}

export function resolveFixturePath(urlPath: string): string | undefined {
  const path = urlPath.split("?", 1)[0] ?? "/";
  const rel = normalize(path === "/" ? "/index.html" : path).replace(/^[/\\]+/, "");
  const full = join(fixtureRoot(), rel);
  if (!full.startsWith(fixtureRoot() + sep) && full !== fixtureRoot()) return undefined;
  return full;
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const full = resolveFixturePath(req.url ?? "/");
  if (!full) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("bad request");
    return;
  }
  try {
    const body = await readFile(full);
    res.writeHead(200, { "content-type": MIME[extname(full)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
}

export async function startFixtureServer(port = 0): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((done,fail)=>{
    const failed=(error:Error)=>fail(error);
    server.once("error",failed);
    server.listen(port,"127.0.0.1",()=>{server.off("error",failed);done();});
  });
  const address=server.address();
  if(!address || typeof address==="string")throw new Error("Fixture TCP listener unavailable");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
  };
}

const standalonePort = Number(process.env["SYNTH_PORT"] ?? 4123);
if (process.argv[1]?.endsWith("serve.js")) {
  const fixture=await startFixtureServer(standalonePort);
  console.log(`synthetic fixtures on ${fixture.url}/`);
}
