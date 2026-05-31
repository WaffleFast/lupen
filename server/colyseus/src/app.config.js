import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { matchMaker, Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LupenSectorRoom } from "./rooms/LupenSectorRoom.js";

export const ROOM_NAME = "lupen_sector";
export const LEGACY_ROOM_NAME = "lupen_test";
export const ALLOWED_CORS_ORIGINS = [
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://www.lupen.io",
  "https://lupen.io"
];

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(prototypeRoot, "public");
const browserClientPath = path.join(prototypeRoot, "node_modules", "colyseus.js", "dist", "colyseus.js");
const allowedCorsOriginSet = new Set(ALLOWED_CORS_ORIGINS);

function isCorsOriginAllowed(origin) {
  return !origin || allowedCorsOriginSet.has(origin);
}

function getCorsHeaderOrigin(origin) {
  return origin && allowedCorsOriginSet.has(origin) ? origin : "null";
}

// Colyseus handles /matchmake/* internally, outside this local HTTP handler.
// Override its CORS hook so Cloud staging can receive browser matchmaking
// requests only from the explicit local/staging allow-list.
matchMaker.controller.getCorsHeaders = function getLupenCorsHeaders(req) {
  const origin = req.headers?.origin;
  return {
    "Access-Control-Allow-Origin": getCorsHeaderOrigin(origin),
    "Vary": "Origin"
  };
};

const corsMiddleware = cors({
  origin(origin, callback) {
    callback(null, isCorsOriginAllowed(origin));
  },
  credentials: true,
  methods: ["OPTIONS", "POST", "GET"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  maxAge: 2592000
});

function applyCors(req, res, next) {
  corsMiddleware(req, res, next);
}

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
    applyCors(req, res, () => {
      const requestUrl = new URL(req.url || "/", "http://localhost");

      if (requestUrl.pathname === "/" || requestUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          service: "lupen-colyseus-prototype",
          status: process.env.NODE_ENV === "production" ? "staging-ready" : "local-only",
          preferredRoom: ROOM_NAME,
          rooms: [ROOM_NAME, LEGACY_ROOM_NAME]
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
  });
}

export function createGameServer(httpServer = createHttpServer()) {
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false
  });

  gameServer.define(ROOM_NAME, LupenSectorRoom);
  gameServer.define(LEGACY_ROOM_NAME, LupenSectorRoom);

  return gameServer;
}

export default createGameServer;
