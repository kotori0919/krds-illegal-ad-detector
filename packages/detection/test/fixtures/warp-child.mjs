import { createServer, connect } from "node:net";
import process from "node:process";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers";
const [username, password, destination, mode] = process.argv.slice(2);
const sockets = new Set();
const server = createServer((socket) => {
  sockets.add(socket); socket.on("close", () => sockets.delete(socket));
  let header = "";
  socket.on("data", function read(chunk) {
    header += chunk;
    if (!header.includes("\r\n\r\n")) return;
    socket.off("data", read);
    if (!header.startsWith("CONNECT 1.1.1.1:443 HTTP/1.1\r\n")) { socket.destroy(); return; }
    if (!header.includes(`Proxy-Authorization: Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`)) {
      socket.end("HTTP/1.1 407 Authentication Required\r\n\r\n"); return;
    }
    const upstream = connect(Number(destination), "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection established\r\n\r\n");
      socket.pipe(upstream); upstream.pipe(socket);
    });
    upstream.on("error", () => socket.destroy()); socket.on("close", () => upstream.destroy());
  });
});
server.listen(0, "127.0.0.1", () => {
  process.stdout.write("proxy ready\nPO");
  setTimeout(() => process.stdout.write(`RT=${server.address().port}\n`), 5);
  if (mode === "exit") setTimeout(() => process.exit(9), 40);
});
process.stdin.on("data", (chunk) => {
  const message = String(chunk).trim() === "connect" ? "Failed to connect tunnel:" : String(chunk).trim() === "failed" ? "Tunnel connection failed:" : "Tunnel connection lost:";
  process.stderr.write(message.slice(0,12));
  setTimeout(() => process.stderr.write(`${message.slice(12)} private fixture detail\n`), 5);
});
