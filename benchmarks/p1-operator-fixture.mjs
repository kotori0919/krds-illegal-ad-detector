/** Served P1 fixture: real OCR limits, frame captions and colliding resources. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

function resourceHash(url) {
  let hash = 0x811c9dc5;
  for (const character of `Resource:${url}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function collidingResources(hosts) {
  const observed = new Map();
  let random = 123456789;
  for (let index = 0; index < 400_000; index++) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const side = index % 2;
    const url = `${hosts[side]}/assets/${random.toString(16)}.png`;
    const hash = resourceHash(url), prior = observed.get(hash);
    if (prior && prior.side !== side) return side ? [prior.url, url] : [url, prior.url];
    observed.set(hash, { side, url });
  }
  throw new Error("controlled cross-host resource collision not found");
}

export async function startOperatorFixture({ ports = [0, 0, 0], advertiseHost = "127.0.0.1", extraRoute } = {}) {
  const banner = await readFile(new URL("../fixtures/ocr/banner.png", import.meta.url));
  const normal = await readFile(new URL("../fixtures/realistic/ads/creative.png", import.meta.url));
  // Different received-byte hashes exercise the existing distinct OCR budget.
  const normals = [normal, ...Array.from({ length: 5 }, (_, i) => Buffer.concat([normal, Buffer.from(`p1-${i}`)]))];
  let origins, resources;
  const requests = [];
  const servers = ports.map((port, side) => createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
    requests.push({ side, path });
    if (extraRoute?.(request, response)) return;
    let body, mime = "text/html; charset=utf-8";
    if (side > 0 && path === new URL(resources[side - 1]).pathname || path === "/banner.png") { body = banner; mime = "image/png"; }
    else if (/^\/normal-[0-5]\.png$/.test(path)) { body = normals[Number(path.match(/\d/)[0])]; mime = "image/png"; }
    else if (path === "/caption-frame") body = "<p>카지노 가입 보너스 지급</p>";
    else if (path === "/banner-frame") body = '<img class="ad" src="/banner.png">';
    else if (path === "/site") body = '<p id="first-ad" style="opacity:0">카지노 가입 보너스 지급</p><p id="second-ad" style="opacity:0">카지노 가입 보너스 지급</p>'
      + `<img class="ad" src="${resources[0]}">` + normals.map((_, i) => `<img class="ad" src="/normal-${i}.png">`).join("")
      + ["frame-main-caption", "frame-image-caption", "collision-a", "collision-b", "collision-b2", "normal", "frame-hidden-caption", "not-considered"]
        .map((name) => `<a href="/${name}">${name}</a>`).join("");
    else if (path === "/frame-main-caption") body = '<p>카지노 가입 보너스 지급</p><iframe id="ad-frame" src="/banner-frame"></iframe>';
    else if (path === "/frame-image-caption") body = '<img class="ad" src="/banner.png"><iframe id="caption" src="/caption-frame"></iframe>';
    else if (path === "/frame-hidden-caption") body = '<img class="ad" src="/banner.png"><iframe id="caption" style="opacity:0" src="/caption-frame"></iframe>';
    else if (path === "/collision-a") body = `<img class="ad" src="${resources[0]}">`;
    else if (path === "/collision-b" || path === "/collision-b2") body = `<img class="ad" src="${resources[1]}">`;
    else if (path === "/normal" || path === "/not-considered") body = '<img class="ad" src="/normal-0.png">';
    else { response.writeHead(404); response.end("missing"); return; }
    if (typeof body === "string") body = Buffer.from(`<!doctype html><html lang="ko"><meta charset="utf-8"><title>P1 operator fixture</title><body>${body}</body></html>`);
    response.writeHead(200, { "content-type": mime, "content-length": body.length }); response.end(body);
  }));
  try {
    await Promise.all(servers.map((server, index) => new Promise((resolve, reject) => {
      server.once("error", reject); server.listen(ports[index], "127.0.0.1", resolve);
    })));
    origins = servers.map((server) => `http://${advertiseHost}:${server.address().port}`);
    resources = collidingResources(origins.slice(1));
    return { entryUrl: `${origins[0]}/site`, resources, requests,
      close: async () => { await Promise.all(servers.map((server) => new Promise((done) => { server.closeAllConnections(); server.close(done); }))); } };
  } catch (error) {
    for (const server of servers) { server.closeAllConnections(); server.close(); }
    throw error;
  }
}
