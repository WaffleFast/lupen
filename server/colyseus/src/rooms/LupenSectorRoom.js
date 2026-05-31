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

export const STAGING_BOT_ALLOWED_NODE_IDS = [
  "Upper Apex",
  "Upper Arc West",
  "Upper Arc East",
  "Upper Mid West B",
  "Upper Mid East B",
  "Upper Lane West B",
  "Upper Lane Core West",
  "Upper Lane Core East",
  "Upper Lane East B",
  "Upper Gate West",
  "Upper Gate Core",
  "Upper Gate East",
  "Lower Gate West",
  "Lower Gate Core",
  "Lower Gate East",
  "Lower Lane West B",
  "Lower Lane Core West",
  "Lower Lane Core East",
  "Lower Lane East B",
  "Lower Mid West B",
  "Lower Mid East B",
  "Lower Arc West",
  "Lower Arc East",
  "Lower Apex"
];

// Combat-only subset of the current Lupen sector map. Staging bots deliberately
// avoid planets and safe travel links so the shared multiplayer layer reads as
// a hostile-sector presence test, not real economy/travel simulation.
const STAGING_BOT_NODES = [
  { node: "Upper Apex", x: 50, y: 14, connects: ["Upper Arc West", "Upper Arc East"] },
  { node: "Upper Arc West", x: 30, y: 20.5, connects: ["Upper Apex", "Upper Mid West B"] },
  { node: "Upper Arc East", x: 70, y: 20.5, connects: ["Upper Apex", "Upper Mid East B"] },
  { node: "Upper Mid West B", x: 40, y: 28, connects: ["Upper Arc West", "Upper Lane West B", "Upper Lane Core West"] },
  { node: "Upper Mid East B", x: 60, y: 28, connects: ["Upper Arc East", "Upper Lane Core East", "Upper Lane East B"] },
  { node: "Upper Lane West B", x: 26, y: 36.5, connects: ["Upper Mid West B", "Upper Gate West", "Upper Gate Core"] },
  { node: "Upper Lane Core West", x: 46, y: 36.5, connects: ["Upper Mid West B", "Upper Gate Core"] },
  { node: "Upper Lane Core East", x: 54, y: 36.5, connects: ["Upper Mid East B", "Upper Gate Core"] },
  { node: "Upper Lane East B", x: 74, y: 36.5, connects: ["Upper Mid East B", "Upper Gate Core", "Upper Gate East"] },
  { node: "Upper Gate West", x: 18, y: 43, connects: ["Upper Lane West B", "Upper Gate Core"] },
  { node: "Upper Gate Core", x: 50, y: 43, connects: ["Upper Gate West", "Upper Lane Core West", "Upper Lane Core East", "Upper Gate East"] },
  { node: "Upper Gate East", x: 82, y: 43, connects: ["Upper Lane East B", "Upper Gate Core"] },
  { node: "Lower Gate West", x: 18, y: 57, connects: ["Lower Lane West B", "Lower Gate Core"] },
  { node: "Lower Gate Core", x: 50, y: 57, connects: ["Lower Gate West", "Lower Lane Core West", "Lower Lane Core East", "Lower Gate East"] },
  { node: "Lower Gate East", x: 82, y: 57, connects: ["Lower Lane East B", "Lower Gate Core"] },
  { node: "Lower Lane West B", x: 26, y: 63.5, connects: ["Lower Mid West B", "Lower Gate West", "Lower Gate Core"] },
  { node: "Lower Lane Core West", x: 46, y: 63.5, connects: ["Lower Mid West B", "Lower Gate Core"] },
  { node: "Lower Lane Core East", x: 54, y: 63.5, connects: ["Lower Mid East B", "Lower Gate Core"] },
  { node: "Lower Lane East B", x: 74, y: 63.5, connects: ["Lower Mid East B", "Lower Gate Core", "Lower Gate East"] },
  { node: "Lower Mid West B", x: 40, y: 72, connects: ["Lower Arc West", "Lower Lane West B", "Lower Lane Core West"] },
  { node: "Lower Mid East B", x: 60, y: 72, connects: ["Lower Arc East", "Lower Lane Core East", "Lower Lane East B"] },
  { node: "Lower Arc West", x: 30, y: 79.5, connects: ["Lower Apex", "Lower Mid West B"] },
  { node: "Lower Arc East", x: 70, y: 79.5, connects: ["Lower Apex", "Lower Mid East B"] },
  { node: "Lower Apex", x: 50, y: 86, connects: ["Lower Arc West", "Lower Arc East"] }
];

const BOT_NODE_POSITIONS = new Map(STAGING_BOT_NODES.map((entry) => [entry.node, entry]));
const BOT_NODE_LINKS = new Map(
  STAGING_BOT_NODES.map((entry) => [
    entry.node,
    entry.connects.filter((nodeId) => STAGING_BOT_ALLOWED_NODE_IDS.includes(nodeId))
  ])
);
const BOT_MOVE_TICK_MS = 4000;
const BOT_NODE_MOVE_MS = 16000;
const STAGING_TEST_DAMAGE = 5;
const STAGING_FIRE_COOLDOWN_MS = 900;
const STAGING_BOT_DISABLED_RESET_MS = 6500;

const DUMMY_BOT_DEFINITIONS = [
  { id: "dev-bot-erebus-1", type: "Erebus Drone", name: "Erebus Drone", startNode: "Upper Arc West", level: 1, shield: 35, hull: 70 },
  { id: "dev-bot-erebus-2", type: "Erebus Drone", name: "Erebus Scout", startNode: "Upper Lane East B", level: 1, shield: 28, hull: 58 },
  { id: "dev-bot-erebus-3", type: "Erebus Drone", name: "Erebus Watcher", startNode: "Lower Lane West B", level: 2, shield: 42, hull: 82 },
  { id: "dev-bot-erebus-4", type: "Erebus Drone", name: "Erebus Surveyor", startNode: "Lower Arc East", level: 2, shield: 38, hull: 76 }
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
type("string")(LupenSectorPlayer.prototype, "selectedTargetBotId");
type("number")(LupenSectorPlayer.prototype, "x");
type("number")(LupenSectorPlayer.prototype, "y");
type("number")(LupenSectorPlayer.prototype, "joinedAt");
type("number")(LupenSectorPlayer.prototype, "lastSeenAt");
type("number")(LupenSectorPlayer.prototype, "lastFireAt");
type("number")(LupenSectorPlayer.prototype, "nextFireAt");

export class LupenSectorBot extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorBot.prototype, "id");
type("string")(LupenSectorBot.prototype, "type");
type("string")(LupenSectorBot.prototype, "name");
type("string")(LupenSectorBot.prototype, "faction");
type("string")(LupenSectorBot.prototype, "currentNode");
type("number")(LupenSectorBot.prototype, "x");
type("number")(LupenSectorBot.prototype, "y");
type("number")(LupenSectorBot.prototype, "level");
type("number")(LupenSectorBot.prototype, "shield");
type("number")(LupenSectorBot.prototype, "shieldMax");
type("number")(LupenSectorBot.prototype, "hull");
type("number")(LupenSectorBot.prototype, "hullMax");
type("number")(LupenSectorBot.prototype, "lastUpdatedAt");
type("number")(LupenSectorBot.prototype, "nextMoveAt");
type("boolean")(LupenSectorBot.prototype, "visualOnly");
type("boolean")(LupenSectorBot.prototype, "disabled");
type("number")(LupenSectorBot.prototype, "disabledUntil");

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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function validateCombatIntentPayload(message = {}) {
  if (!message || typeof message !== "object") {
    return "payload must be an object";
  }

  if (typeof message.targetBotId !== "string" || !message.targetBotId.trim()) {
    return "targetBotId must be a non-empty string";
  }

  if (message.currentNode !== undefined && typeof message.currentNode !== "string") {
    return "currentNode must be a string when provided";
  }

  return "";
}

function validateTargetSelectionPayload(message = {}) {
  if (!message || typeof message !== "object") {
    return "payload must be an object";
  }

  if (typeof message.targetBotId !== "string" || !message.targetBotId.trim()) {
    return "targetBotId must be a non-empty string";
  }

  if (message.currentNode !== undefined && typeof message.currentNode !== "string") {
    return "currentNode must be a string when provided";
  }

  return "";
}

// Presence-only stepping stone for future server-authoritative multiplayer.
// This room mirrors local player display/location data and server-owned dummy
// bot positions for dev ghosts only. It does not persist state, grant rewards,
// run real combat, or control the real single-player game. Staging combat
// intents may apply tiny server-owned test damage to visual bots only; this
// never grants progression, loot, saves, bounties, XP, credits, or rewards.
export class LupenSectorRoom extends Room {
  onCreate() {
    this.setState(new LupenSectorState());
    this.botStep = 0;

    this.spawnDummyBots();
    this.botInterval = this.clock.setInterval(() => {
      this.updateStagingBots();
    }, BOT_MOVE_TICK_MS);

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

    // Staging-only combat intent pipeline. This validates lock-on state against
    // server-owned visual bots, then applies fixed shield-first test damage
    // without granting rewards. Future authoritative combat can replace this
    // response path with real server-side resolution.
    this.onMessage("combat:intent", (client, message = {}) => {
      this.resolveCombatIntent(client, message, "combat:intent");
    });

    // Legacy local prototype alias. New clients should send combat:intent.
    this.onMessage("combat_intent", (client, message = {}) => {
      this.resolveCombatIntent(client, message, "combat_intent");
    });

    // Staging lock-on preparation only. This stores display-only bot selection
    // on the player's presence record without creating real combat targets,
    // timers, damage, rewards, or progression.
    this.onMessage("target:select", (client, message = {}) => {
      this.selectStagingBot(client, message, "target:select");
    });

    this.onMessage("staging:selectBot", (client, message = {}) => {
      this.selectStagingBot(client, message, "staging:selectBot");
    });

    this.onMessage("target:clear", (client) => {
      this.clearStagingBotSelection(client, "target:clear");
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
      selectedTargetBotId: "",
      x: getNumberValue(options.x, 50),
      y: getNumberValue(options.y, 50),
      joinedAt: now,
      lastSeenAt: now,
      lastFireAt: 0,
      nextFireAt: 0
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
      const patrolNode = BOT_NODE_POSITIONS.get(definition.startNode) || STAGING_BOT_NODES[index % STAGING_BOT_NODES.length];
      this.state.bots.set(definition.id, new LupenSectorBot({
        id: definition.id,
        type: definition.type,
        name: definition.name,
        faction: "Erebus",
        currentNode: patrolNode.node,
        x: patrolNode.x + (index % 2 === 0 ? 1.2 : -1.2),
        y: patrolNode.y + (index % 2 === 0 ? -1.2 : 1.2),
        level: Number(definition.level || 1),
        shield: Number(definition.shield || 0),
        shieldMax: Number(definition.shield || 0),
        hull: Number(definition.hull || 1),
        hullMax: Number(definition.hull || 1),
        lastUpdatedAt: now,
        nextMoveAt: now + BOT_NODE_MOVE_MS + index * 2500,
        visualOnly: true,
        disabled: false,
        disabledUntil: 0
      }));
    });
  }

  updateStagingBots() {
    const now = Date.now();
    this.botStep += 1;

    // Staging-only shared bot simulation. These are Colyseus-owned visual
    // markers so connected clients see the same bot positions before real
    // authoritative combat exists. They never enter loot, XP, targeting, or
    // bounty systems.
    Array.from(this.state.bots.values()).forEach((bot, index) => {
      if (bot.disabled && now >= Number(bot.disabledUntil || 0)) {
        this.respawnStagingBot(bot, index, now);
      }

      if (bot.disabled) return;

      const shouldChangeNode = now >= Number(bot.nextMoveAt || 0);
      const activeBotIndex = this.botStep % Math.max(1, this.state.bots.size);

      if (shouldChangeNode && index === activeBotIndex) {
        bot.currentNode = this.getNextBotNode(bot.currentNode, index);
        bot.nextMoveAt = now + BOT_NODE_MOVE_MS + index * 1250;
      }

      const nodePosition = BOT_NODE_POSITIONS.get(bot.currentNode) || STAGING_BOT_NODES[0];
      const driftX = (((this.botStep + index) % 5) - 2) * 0.55;
      const driftY = (((this.botStep * 2 + index) % 5) - 2) * 0.4;
      bot.x = clampNumber(nodePosition.x + driftX, 4, 96);
      bot.y = clampNumber(nodePosition.y + driftY, 4, 96);
      bot.lastUpdatedAt = now;
    });

    this.reconcilePlayerSelections();
  }

  getNextBotNode(currentNode, index = 0) {
    const options = BOT_NODE_LINKS.get(currentNode) || STAGING_BOT_ALLOWED_NODE_IDS;
    const nextNode = options[(this.botStep + index) % options.length] || currentNode || STAGING_BOT_ALLOWED_NODE_IDS[0];
    return STAGING_BOT_ALLOWED_NODE_IDS.includes(nextNode) ? nextNode : STAGING_BOT_ALLOWED_NODE_IDS[0];
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

  sendTargetRejected(client, reason, messageType, targetBotId = "") {
    client.send("target:rejected", {
      ok: false,
      reason,
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      receivedAt: Date.now()
    });
  }

  sendCombatRejected(client, reason, message = {}, messageType = "combat:intent", validation = "", extra = {}) {
    const player = this.state.players.get(client.sessionId);
    const targetBotId = getStringValue(message.targetBotId);
    const targetBot = targetBotId ? this.state.bots.get(targetBotId) : null;

    client.send("combat:rejected", {
      ok: false,
      reason,
      validation,
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      targetNode: targetBot?.currentNode || "",
      currentNode: player?.currentNode || getStringValue(message.currentNode) || "",
      weaponId: getStringValue(message.weaponId),
      weaponFamily: getStringValue(message.weaponFamily),
      rewardsGranted: false,
      receivedAt: Date.now(),
      ...extra
    });
  }

  selectStagingBot(client, message = {}, messageType = "target:select") {
    const player = this.touchPlayer(client.sessionId);
    const payloadWarning = validateTargetSelectionPayload(message);
    const targetBotId = getStringValue(message.targetBotId);
    const targetBot = targetBotId ? this.state.bots.get(targetBotId) : null;
    const requestedNode = getStringValue(message.currentNode, player?.currentNode || "");

    if (payloadWarning) {
      this.sendTargetRejected(client, payloadWarning, messageType, targetBotId);
      return;
    }

    if (!player) {
      this.sendTargetRejected(client, "session player not found", messageType, targetBotId);
      return;
    }

    if (!targetBot) {
      this.sendTargetRejected(client, `unknown staging bot: ${targetBotId}`, messageType, targetBotId);
      return;
    }

    if (requestedNode && requestedNode !== player.currentNode) {
      this.sendTargetRejected(client, "selection node does not match player node", messageType, targetBotId);
      return;
    }

    if (targetBot.currentNode !== player.currentNode) {
      this.sendTargetRejected(client, "player and staging bot are not in the same node", messageType, targetBotId);
      return;
    }

    player.selectedTargetBotId = targetBotId;
    client.send("target:selected", {
      ok: true,
      reason: "lock_on_only_combat_disabled",
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      currentNode: player.currentNode,
      receivedAt: Date.now()
    });
  }

  clearStagingBotSelection(client, messageType = "target:clear") {
    const player = this.touchPlayer(client.sessionId);
    if (player) player.selectedTargetBotId = "";
    client.send("target:selected", {
      ok: true,
      reason: "selection_cleared",
      messageType,
      sessionId: client.sessionId,
      targetBotId: "",
      currentNode: player?.currentNode || "",
      receivedAt: Date.now()
    });
  }

  reconcilePlayerSelection(player) {
    if (!player?.selectedTargetBotId) return;
    const bot = this.state.bots.get(player.selectedTargetBotId);
    if (!bot || bot.currentNode !== player.currentNode) {
      player.selectedTargetBotId = "";
    }
  }

  reconcilePlayerSelections() {
    this.state.players.forEach((player) => this.reconcilePlayerSelection(player));
  }

  applyStagingTestDamage(bot, damage = STAGING_TEST_DAMAGE) {
    const now = Date.now();
    const safeDamage = Math.max(0, Number(damage || 0));
    const shieldBefore = Math.max(0, Number(bot.shield || 0));
    const hullBefore = Math.max(0, Number(bot.hull || 0));
    const shieldDamage = Math.min(shieldBefore, safeDamage);
    const hullDamage = Math.min(hullBefore, safeDamage - shieldDamage);

    bot.shield = clampNumber(shieldBefore - shieldDamage, 0, Number(bot.shieldMax || 0));
    bot.hull = clampNumber(hullBefore - hullDamage, 0, Number(bot.hullMax || 1));
    bot.disabled = bot.hull <= 0;
    bot.disabledUntil = bot.disabled ? now + STAGING_BOT_DISABLED_RESET_MS : 0;
    bot.lastUpdatedAt = now;

    return {
      damage: shieldDamage + hullDamage,
      shieldDamage,
      hullDamage,
      shield: bot.shield,
      hull: bot.hull,
      disabled: bot.disabled
    };
  }

  respawnStagingBot(bot, index = 0, now = Date.now()) {
    const respawnNode = this.getNextBotNode(bot.currentNode, index + this.botStep + 1);
    const nodePosition = BOT_NODE_POSITIONS.get(respawnNode) || STAGING_BOT_NODES[index % STAGING_BOT_NODES.length] || STAGING_BOT_NODES[0];

    bot.currentNode = nodePosition.node;
    bot.x = clampNumber(nodePosition.x, 4, 96);
    bot.y = clampNumber(nodePosition.y, 4, 96);
    bot.shield = Number(bot.shieldMax || 0);
    bot.hull = Number(bot.hullMax || 1);
    bot.disabled = false;
    bot.disabledUntil = 0;
    bot.lastUpdatedAt = now;
    bot.nextMoveAt = now + BOT_NODE_MOVE_MS + index * 1250;

    this.broadcast("bot:respawned", {
      ok: true,
      botId: bot.id,
      currentNode: bot.currentNode,
      shield: bot.shield,
      hull: bot.hull,
      rewardsGranted: false,
      receivedAt: now
    });

    this.reconcilePlayerSelections();
  }

  resolveCombatIntent(client, message = {}, messageType = "combat:intent") {
    const player = this.touchPlayer(client.sessionId);
    const now = Date.now();
    const payloadWarning = validateCombatIntentPayload(message);
    const targetBotId = getStringValue(message.targetBotId);
    const targetBot = targetBotId ? this.state.bots.get(targetBotId) : null;
    const clientCurrentNode = getStringValue(message.currentNode, player?.currentNode || "");
    let validationReason = payloadWarning;

    if (!validationReason && !player) {
      validationReason = "session player not found";
    }

    if (!validationReason && !targetBot) {
      validationReason = `unknown staging bot: ${targetBotId}`;
    }

    if (!validationReason && !player.selectedTargetBotId) {
      validationReason = "no staging bot selected";
    }

    if (!validationReason && player.selectedTargetBotId !== targetBotId) {
      validationReason = "combat target does not match selected staging bot";
    }

    if (!validationReason && Number(player.nextFireAt || 0) > now) {
      this.sendCombatRejected(client, "staging_fire_cooldown", message, messageType, "fire cooldown active", {
        cooldownRemainingMs: Math.max(0, Math.ceil(Number(player.nextFireAt || 0) - now))
      });
      return;
    }

    if (!validationReason && clientCurrentNode && clientCurrentNode !== player.currentNode) {
      validationReason = "combat node does not match player node";
    }

    if (!validationReason && targetBot.currentNode !== player.currentNode) {
      validationReason = "player and staging bot are not in the same node";
    }

    if (!validationReason && targetBot.disabled) {
      validationReason = "staging_bot_disabled";
    }

    if (validationReason) {
      this.sendCombatRejected(client, "combat_intent_rejected", message, messageType, validationReason);
      return;
    }

    const result = this.applyStagingTestDamage(targetBot, STAGING_TEST_DAMAGE);
    player.lastFireAt = now;
    player.nextFireAt = now + STAGING_FIRE_COOLDOWN_MS;

    client.send("combat:resolved", {
      ok: true,
      reason: "staging_damage_applied",
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      targetNode: targetBot.currentNode,
      currentNode: player.currentNode,
      weaponId: getStringValue(message.weaponId),
      weaponFamily: getStringValue(message.weaponFamily),
      damage: result.damage,
      shieldDamage: result.shieldDamage,
      hullDamage: result.hullDamage,
      shield: result.shield,
      hull: result.hull,
      disabled: result.disabled,
      cooldownMs: STAGING_FIRE_COOLDOWN_MS,
      nextFireAt: player.nextFireAt,
      rewardsGranted: false,
      receivedAt: Date.now()
    });

    if (result.disabled) {
      this.broadcast("bot:disabled", {
        ok: true,
        botId: targetBot.id,
        currentNode: targetBot.currentNode,
        shield: targetBot.shield,
        hull: targetBot.hull,
        disabledUntil: targetBot.disabledUntil,
        rewardsGranted: false,
        receivedAt: Date.now()
      });
    }
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
    this.reconcilePlayerSelection(player);
  }
}
