import http from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LupenTestRoom } from "./rooms/LupenTestRoom.js";

export const ROOM_NAME = "lupen_test";

export function createHttpServer() {
  return http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        service: "lupen-colyseus-prototype",
        status: "local-only",
        rooms: [ROOM_NAME]
      }));
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
