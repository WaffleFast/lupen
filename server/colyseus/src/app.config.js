import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import config from "@colyseus/tools";
import { matchMaker } from "colyseus";
import { LupenSectorRoom } from "./rooms/LupenSectorRoom.js";
import {
  checkRewardLedgerConnectivity,
  isRewardWriteEnabled
} from "./services/rewardLedgerService.js";

export const ROOM_NAME = "lupen_sector";
export const LEGACY_ROOM_NAME = "lupen_test";
export const DEFAULT_PORT = 2567;
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

export function getEffectiveListenPort(basePort = Number(process.env.PORT || DEFAULT_PORT)) {
  const cloudPort = process.env.COLYSEUS_CLOUD !== undefined ? DEFAULT_PORT : basePort;
  return cloudPort + Number(process.env.NODE_APP_INSTANCE || "0");
}

function getDefaultRewardLedgerHealth() {
  return {
    ledgerReachable: "unknown",
    rewardWritesEnabled: isRewardWriteEnabled(),
    reason: "not_checked"
  };
}

function sanitizeRewardLedgerHealth(checkResult = {}) {
  return {
    ledgerReachable: checkResult.ledgerReachable === true,
    rewardWritesEnabled: checkResult.rewardWritesEnabled === true,
    reason: checkResult.reason || "",
    status: Number(checkResult.status || 0)
  };
}

export function getHealthPayload(port = getEffectiveListenPort(), rewardLedger = getDefaultRewardLedgerHealth()) {
  return {
    ok: true,
    service: "lupen-colyseus-prototype",
    status: process.env.NODE_ENV === "production" ? "staging-ready" : "local-only",
    rooms: [ROOM_NAME, LEGACY_ROOM_NAME],
    preferredRoom: ROOM_NAME,
    environment: process.env.NODE_ENV || "development",
    port,
    rewardLedger
  };
}

async function getHealthPayloadWithLedger(port = getEffectiveListenPort()) {
  const rewardLedgerCheck = await checkRewardLedgerConnectivity();
  return getHealthPayload(port, sanitizeRewardLedgerHealth(rewardLedgerCheck));
}

function isCorsOriginAllowed(origin) {
  return !origin || allowedCorsOriginSet.has(origin);
}

function getCorsHeaderOrigin(origin) {
  return origin && allowedCorsOriginSet.has(origin) ? origin : "null";
}

function applyLupenCors(req, res, next) {
  cors({
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin));
    },
    credentials: true,
    methods: ["OPTIONS", "POST", "GET"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    maxAge: 2592000
  })(req, res, next);
}

// Colyseus handles /matchmake/* before Express routes. Override its CORS hook
// so Cloud staging accepts browser matchmaking only from the explicit allow-list.
matchMaker.controller.getCorsHeaders = function getLupenCorsHeaders(req) {
  const origin = req.headers?.origin;
  return {
    "Access-Control-Allow-Origin": getCorsHeaderOrigin(origin),
    "Vary": "Origin"
  };
};

function logStartupDiagnostics() {
  const finalPort = getEffectiveListenPort();
  const healthEndpoint = process.env.COLYSEUS_CLOUD !== undefined
    ? `/run/colyseus/${finalPort}.sock via /health`
    : `http://localhost:${finalPort}/health`;

  console.log("[Lupen Colyseus] startup diagnostics");
  console.log(`[Lupen Colyseus] process.env.PORT: ${process.env.PORT || "(not set)"}`);
  console.log(`[Lupen Colyseus] final listen port: ${finalPort}`);
  console.log(`[Lupen Colyseus] NODE_ENV: ${process.env.NODE_ENV || "(not set)"}`);
  console.log(`[Lupen Colyseus] COLYSEUS_CLOUD: ${process.env.COLYSEUS_CLOUD || "(not set)"}`);
  console.log(`[Lupen Colyseus] NODE_APP_INSTANCE: ${process.env.NODE_APP_INSTANCE || "0"}`);
  console.log(`[Lupen Colyseus] registered room: ${ROOM_NAME}`);
  console.log(`[Lupen Colyseus] health endpoint: ${healthEndpoint}`);
  console.log(`[Lupen Colyseus] CORS allowed origins (${ALLOWED_CORS_ORIGINS.length}): ${ALLOWED_CORS_ORIGINS.join(", ")}`);
  console.log("[Lupen Colyseus] health payload:", JSON.stringify(getHealthPayload(finalPort)));
}

export default config({
  beforeListen() {
    logStartupDiagnostics();
  },

  initializeExpress(app) {
    app.use(applyLupenCors);

    app.get(["/", "/health"], async (_req, res) => {
      res.status(200).json(await getHealthPayloadWithLedger());
    });

    app.get("/test-client.html", (_req, res) => {
      res.type("html").sendFile(path.join(publicRoot, "test-client.html"));
    });

    app.get("/colyseus.js", (_req, res) => {
      res.type("application/javascript").sendFile(browserClientPath);
    });
  },

  initializeGameServer(gameServer) {
    gameServer.define(ROOM_NAME, LupenSectorRoom);
    gameServer.define(LEGACY_ROOM_NAME, LupenSectorRoom);
  }
});
