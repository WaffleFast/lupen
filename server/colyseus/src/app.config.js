import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LupenTestRoom } from "./rooms/LupenTestRoom.js";

export const ROOM_NAME = "lupen_test";

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(prototypeRoot, "public");
const browserClientPath = path.join(prototypeRoot, "node_modules", "colyseus.js", "dist", "colyseus.js");

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

export function createHttpServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://localhost");

    if (requestUrl.pathname === "/" || requestUrl.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        service: "lupen-colyseus-prototype",
        status: "local-only",
        rooms: [ROOM_NAME]
      }));
      return;
    }

    if (requestUrl.pathname === "/test-client.html") {
      serveFile(res, path.join(publicRoot, "test-client.html"), "text/html; charset=utf-8");
      return;
    }

    if (requestUrl.pathname === "/colyseus.js") {
      serveFile(res, browserClientPath, "application/javascript; charset=utf-8");
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  });
}

export function createGameServer(httpServer = createHttpServer()) {
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false
  });

  gameServer.define(ROOM_NAME, LupenTestRoom);

  return gameServer;
}

export default createGameServer;
