import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const clientCount = clampInteger(process.env.SOAK_CLIENTS, 1, 50, 12);
const durationSeconds = clampInteger(process.env.SOAK_DURATION_SECONDS, 10, 600, 45);
const stepMs = clampInteger(process.env.SOAK_STEP_MS, 500, 10000, 2000);
const reconnectEnabled = String(process.env.SOAK_RECONNECT || "true").toLowerCase() !== "false";
const roomName = process.env.COLYSEUS_ROOM || ROOM_NAME;
const nodes = [
  "Asteron Prime",
  "Upper Gate Core",
  "Upper Arc West",
  "Upper Arc East",
  "Lower Gate Core",
  "Lower Arc West",
  "Lower Arc East"
];

function clampInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

const startedAt = Date.now();
const records = [];
const errors = [];
let expectedLeaves = 0;
let unexpectedLeaves = 0;
let reconnectCompleted = false;

async function joinPilot(index, generation = 0) {
  const joinStartedAt = Date.now();
  const client = new Client(endpoint);
  const record = {
    index,
    generation,
    client,
    room: null,
    joinMs: 0,
    pingsSent: 0,
    pongsReceived: 0,
    rtts: [],
    pendingPings: new Map(),
    maxPlayersSeen: 0,
    maxBotsSeen: 0,
    expectedLeave: false,
    closed: false
  };
  const room = await client.joinOrCreate(roomName, {
    displayName: `Soak Pilot ${String(index + 1).padStart(2, "0")}`,
    multiplayerMode: "online",
    currentShipId: "falcon",
    shipName: "Pioneer Hunter",
    currentNode: nodes[index % nodes.length],
    presenceStatus: "space",
    x: 20 + ((index * 7) % 60),
    y: 25 + ((index * 11) % 50)
  });
  record.room = room;
  record.joinMs = Date.now() - joinStartedAt;
  records.push(record);

  room.onMessage("playerJoined", () => {});
  room.onMessage("playerMoved", () => {});
  room.onMessage("playerLeft", () => {});
  room.onMessage("pong", (message = {}) => {
    const nonce = String(message?.echo?.soakNonce || "");
    const sentAt = record.pendingPings.get(nonce);
    if (!sentAt) return;
    record.pendingPings.delete(nonce);
    record.pongsReceived += 1;
    record.rtts.push(Date.now() - sentAt);
  });
  room.onError((code, message) => {
    errors.push(`pilot ${index + 1} room error ${code}: ${message || "unknown"}`);
  });
  room.onLeave((code) => {
    record.closed = true;
    if (!record.expectedLeave) {
      unexpectedLeaves += 1;
      errors.push(`pilot ${index + 1} left unexpectedly with code ${code}`);
    }
  });
  return record;
}

async function closeRecord(record) {
  if (!record?.room || record.closed) return;
  record.expectedLeave = true;
  expectedLeaves += 1;
  await record.room.leave();
}

async function main() {
  console.log(`[capacity soak] joining ${clientCount} automated clients at ${endpoint}`);
  for (let offset = 0; offset < clientCount; offset += 4) {
    const batch = [];
    for (let index = offset; index < Math.min(clientCount, offset + 4); index += 1) {
      batch.push(joinPilot(index));
    }
    await Promise.all(batch);
  }

  const runUntil = Date.now() + durationSeconds * 1000;
  const reconnectAt = Date.now() + Math.floor(durationSeconds * 500);
  let tick = 0;
  while (Date.now() < runUntil) {
    const active = records.filter((record) => record.room && !record.closed);
    active.forEach((record) => {
      const playerCount = Number(record.room.state?.players?.size || 0);
      const botCount = Number(record.room.state?.bots?.size || 0);
      record.maxPlayersSeen = Math.max(record.maxPlayersSeen, playerCount);
      record.maxBotsSeen = Math.max(record.maxBotsSeen, botCount);
      const node = nodes[(record.index + tick) % nodes.length];
      record.room.send("movement:update", {
        currentNode: node,
        presenceStatus: "space",
        currentShipId: "falcon",
        x: 18 + ((record.index * 9 + tick * 3) % 64),
        y: 20 + ((record.index * 13 + tick * 5) % 60)
      });
      const nonce = `${record.index}-${record.generation}-${tick}-${Date.now()}`;
      record.pendingPings.set(nonce, Date.now());
      record.pingsSent += 1;
      record.room.send("ping", { soakNonce: nonce });
    });

    if (reconnectEnabled && !reconnectCompleted && Date.now() >= reconnectAt) {
      const original = records.find((record) => record.index === 0 && record.generation === 0);
      await closeRecord(original);
      await joinPilot(0, 1);
      reconnectCompleted = true;
      console.log("[capacity soak] completed one leave/rejoin cycle");
    }
    tick += 1;
    await wait(Math.min(stepMs, Math.max(0, runUntil - Date.now())));
  }

  await wait(1000);
  await Promise.all(records.map(closeRecord));
  const joinTimes = records.map((record) => record.joinMs);
  const rtts = records.flatMap((record) => record.rtts);
  const pingsSent = records.reduce((sum, record) => sum + record.pingsSent, 0);
  const pongsReceived = records.reduce((sum, record) => sum + record.pongsReceived, 0);
  const maxPlayersSeen = Math.max(0, ...records.map((record) => record.maxPlayersSeen));
  const maxBotsSeen = Math.max(0, ...records.map((record) => record.maxBotsSeen));
  const summary = {
    ok: errors.length === 0 &&
      unexpectedLeaves === 0 &&
      maxPlayersSeen >= clientCount &&
      pongsReceived >= Math.floor(pingsSent * 0.95),
    endpoint,
    roomName,
    requestedClients: clientCount,
    durationSeconds,
    reconnectCompleted,
    maxPlayersSeen,
    maxBotsSeen,
    joinMs: {
      median: percentile(joinTimes, 0.5),
      p95: percentile(joinTimes, 0.95),
      max: joinTimes.length ? Math.max(...joinTimes) : null
    },
    ping: {
      sent: pingsSent,
      received: pongsReceived,
      successRate: pingsSent ? Number((pongsReceived / pingsSent).toFixed(4)) : 0,
      medianRttMs: percentile(rtts, 0.5),
      p95RttMs: percentile(rtts, 0.95),
      maxRttMs: rtts.length ? Math.max(...rtts) : null
    },
    expectedLeaves,
    unexpectedLeaves,
    errors,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1))
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch(async (error) => {
  errors.push(error instanceof Error ? error.message : String(error));
  await Promise.allSettled(records.map(closeRecord));
  console.error(JSON.stringify({
    ok: false,
    endpoint,
    requestedClients: clientCount,
    errors
  }, null, 2));
  process.exitCode = 1;
});
