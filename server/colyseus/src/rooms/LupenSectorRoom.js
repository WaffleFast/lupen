import { Room } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";

const KNOWN_SECTOR_NODES = new Set([
  "Virella",
  "West Link 1",
  "West Link 2",
  "Asteron Prime",
  "East Link 1",
  "East Link 2",
  "Nyxara",
  "Upper Apex",
  "Upper Arc West",
  "Upper Arc East",
  "Upper Mid West A",
  "Upper Mid West B",
  "Upper Mid East B",
  "Upper Mid East A",
  "Upper Lane West A",
  "Upper Lane West B",
  "Upper Lane Core West",
  "Upper Lane Core East",
  "Upper Lane East B",
  "Upper Lane East A",
  "Upper Gate West",
  "Upper Gate Core",
  "Upper Gate East",
  "Lower Apex",
  "Lower Arc West",
  "Lower Arc East",
  "Lower Mid West A",
  "Lower Mid West B",
  "Lower Mid East B",
  "Lower Mid East A",
  "Lower Lane West A",
  "Lower Lane West B",
  "Lower Lane Core West",
  "Lower Lane Core East",
  "Lower Lane East B",
  "Lower Lane East A",
  "Lower Gate West",
  "Lower Gate Core",
  "Lower Gate East"
]);

const BOT_PATROL_NODES = [
  { node: "Asteron Prime", x: 50, y: 50 },
  { node: "East Link 1", x: 62, y: 50 },
  { node: "Upper Gate Core", x: 50, y: 30 },
  { node: "Lower Gate Core", x: 50, y: 70 },
  { node: "West Link 1", x: 38, y: 50 }
];

const DUMMY_BOT_DEFINITIONS = [
  { id: "dev-bot-erebus-1", type: "Erebus Drone", name: "Erebus Drone" },
  { id: "dev-bot-erebus-2", type: "Erebus Drone", name: "Erebus Scout" },
  { id: "dev-bot-erebus-3", type: "Erebus Drone", name: "Erebus Watcher" },
  { id: "dev-bot-erebus-4", type: "Erebus Drone", name: "Erebus Surveyor" }
];

export class LupenSectorPlayer extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorPlayer.prototype, "id");
type("string")(LupenSectorPlayer.prototype, "sessionId");
type("string")(LupenSectorPlayer.prototype, "displayName");
type("string")(LupenSectorPlayer.prototype, "currentShipId");
type("string")(LupenSectorPlayer.prototype, "shipName");
type("string")(LupenSectorPlayer.prototype, "currentNode");
type("number")(LupenSectorPlayer.prototype, "x");
type("number")(LupenSectorPlayer.prototype, "y");
type("number")(LupenSectorPlayer.prototype, "joinedAt");
type("number")(LupenSectorPlayer.prototype, "lastSeenAt");

export class LupenSectorBot extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorBot.prototype, "id");
type("string")(LupenSectorBot.prototype, "type");
type("string")(LupenSectorBot.prototype, "name");
type("string")(LupenSectorBot.prototype, "currentNode");
type("number")(LupenSectorBot.prototype, "x");
type("number")(LupenSectorBot.prototype, "y");
type("number")(LupenSectorBot.prototype, "lastUpdatedAt");

export class LupenSectorState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.bots = new MapSchema();
  }
}

type({ map: LupenSectorPlayer })(LupenSectorState.prototype, "players");
type({ map: LupenSectorBot })(LupenSectorState.prototype, "bots");

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getShipName(message = {}) {
  return getStringValue(
    typeof message.shipName === "string" ? message.shipName : message.ship,
    ""
  );
}

function validatePresencePayload(message = {}) {
  if (!message || typeof message !== "object") {
    return "payload must be an object";
  }

  if (typeof message.currentNode !== "string" || !message.currentNode.trim()) {
    return "currentNode must be a non-empty string";
  }

  if (!KNOWN_SECTOR_NODES.has(message.currentNode.trim())) {
    return `unknown currentNode: ${message.currentNode}`;
  }

  if (message.x !== undefined) {
    const x = Number(message.x);
    if (!Number.isFinite(x) || x < -1000 || x > 1000) return "x is outside presence bounds";
  }

  if (message.y !== undefined) {
    const y = Number(message.y);
    if (!Number.isFinite(y) || y < -1000 || y > 1000) return "y is outside presence bounds";
  }

  return "";
}

// Presence-only stepping stone for future server-authoritative multiplayer.
// This room mirrors local player display/location data and server-owned dummy
// bot positions for dev ghosts only. It does not persist state, grant rewards,
// run combat, or control the real single-player game.
export class LupenSectorRoom extends Room {
  onCreate() {
    this.setState(new LupenSectorState());
    this.botStep = 0;

    this.spawnDummyBots();
    this.botInterval = this.clock.setInterval(() => {
      this.updateDummyBots();
    }, 9000);

    this.onMessage("ping", (client, message = {}) => {
      this.touchPlayer(client.sessionId);
      client.send("pong", {
        ok: true,
        sessionId: client.sessionId,
        echo: message
      });
    });

    this.onMessage("presence:update", (client, message = {}) => {
      this.applyPresenceUpdate(client, message, "presence:update");
    });

    this.onMessage("movement:update", (client, message = {}) => {
      this.applyPresenceUpdate(client, message, "movement:update");
    });

    // Legacy local prototype alias. New clients should send movement:update.
    this.onMessage("move", (client, message = {}) => {
      this.applyPresenceUpdate(client, message, "move");
    });
  }

  onJoin(client, options = {}) {
    const now = Date.now();
    this.state.players.set(client.sessionId, new LupenSectorPlayer({
      id: client.sessionId,
      sessionId: client.sessionId,
      displayName: getStringValue(options.displayName, "Pilot") || "Pilot",
      currentShipId: getStringValue(options.currentShipId),
      shipName: getShipName(options),
      currentNode: getStringValue(options.currentNode, "Asteron Prime") || "Asteron Prime",
      x: getNumberValue(options.x, 50),
      y: getNumberValue(options.y, 50),
      joinedAt: now,
      lastSeenAt: now
    }));
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    this.botInterval?.clear?.();
  }

  spawnDummyBots() {
    const now = Date.now();

    DUMMY_BOT_DEFINITIONS.forEach((definition, index) => {
      const patrolNode = BOT_PATROL_NODES[index % BOT_PATROL_NODES.length];
      this.state.bots.set(definition.id, new LupenSectorBot({
        id: definition.id,
        type: definition.type,
        name: definition.name,
        currentNode: patrolNode.node,
        x: patrolNode.x + (index % 2 === 0 ? 1.2 : -1.2),
        y: patrolNode.y + (index % 2 === 0 ? -1.2 : 1.2),
        lastUpdatedAt: now
      }));
    });
  }

  updateDummyBots() {
    const now = Date.now();
    this.botStep += 1;

    Array.from(this.state.bots.values()).forEach((bot, index) => {
      const patrolNode = BOT_PATROL_NODES[(this.botStep + index) % BOT_PATROL_NODES.length];
      const drift = ((this.botStep + index) % 3) - 1;

      bot.currentNode = patrolNode.node;
      bot.x = patrolNode.x + drift * 1.6;
      bot.y = patrolNode.y - drift * 1.2;
      bot.lastUpdatedAt = now;
    });
  }

  touchPlayer(sessionId) {
    const player = this.state.players.get(sessionId);
    if (player) player.lastSeenAt = Date.now();
    return player;
  }

  sendWarning(client, reason, messageType) {
    client.send("presence:warning", {
      ok: false,
      reason,
      messageType,
      sessionId: client.sessionId,
      receivedAt: Date.now()
    });
  }

  applyPresenceUpdate(client, message = {}, messageType = "presence:update") {
    const warning = validatePresencePayload(message);
    if (warning) {
      this.sendWarning(client, warning, messageType);
      return;
    }

    const player = this.touchPlayer(client.sessionId);
    if (!player) return;

    const x = Number(message.x);
    const y = Number(message.y);
    if (Number.isFinite(x)) player.x = x;
    if (Number.isFinite(y)) player.y = y;

    const displayName = getStringValue(message.displayName);
    if (displayName) player.displayName = displayName;

    if (typeof message.currentShipId === "string") {
      player.currentShipId = message.currentShipId.trim();
    }

    if (typeof message.shipName === "string" || typeof message.ship === "string") {
      player.shipName = getShipName(message);
    }

    const currentNode = getStringValue(message.currentNode);
    if (currentNode) player.currentNode = currentNode;
  }
}
