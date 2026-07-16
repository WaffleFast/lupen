import { Room } from "colyseus";
import { Encoder, MapSchema, Schema, type } from "@colyseus/schema";
import {
  buildRewardLedgerEntry,
  writeRewardLedgerEntry
} from "../services/rewardLedgerService.js";
import {
  applyRewardApplicationPlan,
  buildRewardApplicationPlan
} from "../services/rewardApplicationService.js";
import {
  buildProgressionPreview,
  fetchPlayerSavePreviewContext
} from "../services/playerSavePreviewService.js";
import {
  buildProgressionShadowEntry,
  writeProgressionShadowEntry
} from "../services/progressionShadowService.js";
import {
  applyPlayerSavePatchPlan,
  buildPlayerSavePatchPlan
} from "../services/playerSaveWriteService.js";
import {
  applyStagingLootClaimWrite,
  buildStagingLootClaimPlan
} from "../services/lootWriteService.js";
import {
  buildStagingTradePreview,
  buildStagingTradeWriteDryRun,
  getStagingTradeOfferById,
  getStagingTradeOffers
} from "../config/stagingTradeConfig.js";
import {
  buildStagingStorePurchasePreview,
  getStagingStoreItemById,
  getStagingStoreItemIds,
  getStagingStoreItems
} from "../config/stagingStoreConfig.js";
import {
  STAGING_SHIP_CONFIG
} from "../config/stagingShipConfig.js";
import {
  EREBUS_BOT_TYPE_ORDER,
  getErebusBotTypeConfig
} from "../config/stagingBotConfig.js";
import {
  STAGING_BOUNTY,
  STAGING_BOUNTY_ID,
  buildStagingBountySourceEventId,
  createStagingBountyState,
  getStagingBountyConfigById,
  getPublicStagingBountyState,
  getStagingBounties,
  recordStagingBountyBotDestruction
} from "../config/stagingBountyConfig.js";
import {
  fetchPlayerTradeValidationState
} from "../services/playerSaveReadService.js";
import {
  applyStagingTradeBuyWrite,
  applyStagingTradeSellWrite
} from "../services/tradeWriteService.js";
import {
  applyStagingStorePurchaseWrite,
  getStoreWriteEnvGate
} from "../services/storeWriteService.js";
import {
  applyStagingLoadoutEquipWrite,
  buildStagingLoadoutEquipPlan,
  buildStagingLoadoutUnequipPlan,
  STAGING_LOADOUT_ITEM_IDS,
  getLoadoutWriteEnvGate
} from "../services/loadoutWriteService.js";

Encoder.BUFFER_SIZE = Math.max(Encoder.BUFFER_SIZE || 0, 64 * 1024);

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
const PVP_CONTESTED_NODE_IDS = new Set([
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
const KNOWN_SECTOR_NODE_KEYS = new Set(Array.from(KNOWN_SECTOR_NODES, (nodeId) => normalizePresenceNode(nodeId)));
const PVP_CONTESTED_NODE_KEYS = new Set(Array.from(PVP_CONTESTED_NODE_IDS, (nodeId) => normalizePresenceNode(nodeId)));
const STAGING_STORE_WRITE_ITEM_IDS = new Set(getStagingStoreItemIds());
const STAGING_LOADOUT_WRITE_ITEM_IDS = new Set(STAGING_LOADOUT_ITEM_IDS);

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
const STAGING_PVP_TEST_DAMAGE = 90;
const STAGING_PVP_SHIELD_MAX = 30;
const STAGING_PVP_HULL_MAX = 120;
const STAGING_PVP_MIN_HULL = 1;
const STAGING_PVP_SHIELD_REGEN_DELAY_MS = 5000;
const STAGING_PVP_SHIELD_REGEN_TICK_MS = 1000;
const STAGING_PVP_SHIELD_REGEN_AMOUNT = 10;
const STAGING_DAMAGE_MIN = 1;
const STAGING_DAMAGE_MAX = 50;
const STAGING_VOLLEY_DAMAGE_MAX = 80;
const STAGING_EQUIPPED_WEAPON_MAX = 6;
const STAGING_FIRE_COOLDOWN_MS = 900;
const STAGING_FIRE_COOLDOWN_MIN_MS = 450;
const STAGING_FIRE_COOLDOWN_MAX_MS = 2500;
const STAGING_RESOURCE_RESPAWN_MS = 12000;
const SERVER_OBJECT_SAFE_MIN_X = 14;
const SERVER_OBJECT_SAFE_MAX_X = 86;
const SERVER_OBJECT_SAFE_MIN_Y = 14;
const SERVER_OBJECT_SAFE_MAX_Y = 56;
const SERVER_OBJECT_ACTION_MIN_X = 38;
const SERVER_OBJECT_ACTION_MAX_X = 62;
const SERVER_OBJECT_ACTION_MIN_Y = 42;
const SERVER_OBJECT_ACTION_LEFT_X = 34;
const SERVER_OBJECT_ACTION_RIGHT_X = 66;
const SERVER_OBJECT_MIN_GAP_X = 11;
const SERVER_OBJECT_MIN_GAP_Y = 17;
const SERVER_OBJECT_RANDOM_ATTEMPTS = 120;
const STAGING_WEAPON_STATS = Object.freeze({
  heavyLance: Object.freeze({
    key: "heavyLance",
    name: "Heavy Lance",
    family: "heavy",
    type: "heavy",
    damage: 23,
    cooldownMs: 2000
  }),
  ionBlaster: Object.freeze({
    key: "ionBlaster",
    name: "Ion Blaster",
    family: "ion",
    type: "ion",
    damage: 9,
    cooldownMs: 833
  }),
  meltCannon: Object.freeze({
    key: "meltCannon",
    name: "Melt Cannon",
    family: "melt",
    type: "melt",
    damage: 12,
    cooldownMs: 1333
  }),
  pulseLaser: Object.freeze({
    key: "pulseLaser",
    name: "Pulse Laser",
    family: "pulse",
    type: "pulse",
    damage: 13,
    cooldownMs: 1250
  }),
  repeater: Object.freeze({
    key: "repeater",
    name: "Repeater",
    family: "rapid",
    type: "rapid",
    damage: 5,
    cooldownMs: 450
  }),
  ripperGun: Object.freeze({
    key: "ripperGun",
    name: "Ripper Gun",
    family: "ripper",
    type: "ripper",
    damage: 11,
    cooldownMs: 1250
  }),
  voidRail: Object.freeze({
    key: "voidRail",
    name: "Void Rail",
    family: "sniper",
    type: "sniper",
    damage: 15,
    cooldownMs: 2500
  })
});
const STAGING_BOT_DISABLED_RESET_MS = 6500;
const SUPABASE_VERIFY_TIMEOUT_MS = 4000;
const STAGING_REWARD_DRY_RUN_XP = 100;
const STAGING_REWARD_DRY_RUN_CREDITS = 0;
const CHAT_MESSAGE_MAX_LENGTH = 200;

const STAGING_BOT_SPAWN_NODES_BY_TYPE = Object.freeze({
  hunter: Object.freeze([
    "Upper Arc West",
    "Upper Arc East",
    "Upper Mid West B",
    "Upper Mid East B",
    "Upper Lane West B",
    "Upper Lane East B",
    "Lower Lane West B",
    "Lower Lane East B",
    "Lower Mid West B",
    "Lower Mid East B",
    "Lower Arc West",
    "Lower Arc East"
  ]),
  attacker: Object.freeze([
    "Upper Mid West B",
    "Upper Mid East B",
    "Upper Lane Core West",
    "Upper Lane Core East",
    "Upper Gate West",
    "Upper Gate East",
    "Lower Gate West",
    "Lower Gate East",
    "Lower Lane Core West",
    "Lower Lane Core East"
  ]),
  destroyer: Object.freeze([
    "Upper Gate Core",
    "Lower Gate Core",
    "Upper Apex",
    "Lower Apex"
  ]),
  behemoth: Object.freeze([
    "Upper Apex",
    "Lower Apex",
    "Upper Gate Core"
  ])
});

const DUMMY_BOT_DEFINITIONS = EREBUS_BOT_TYPE_ORDER.flatMap((botType) => {
  const config = getErebusBotTypeConfig(botType);
  const spawnNodes = STAGING_BOT_SPAWN_NODES_BY_TYPE[botType] || STAGING_BOT_ALLOWED_NODE_IDS;
  return Array.from({ length: config.targetCount }, (_value, index) => ({
    id: `staging-bot-${botType}-${String(index + 1).padStart(2, "0")}`,
    botType,
    type: config.displayName,
    name: config.displayName,
    displayName: config.displayName,
    startNode: spawnNodes[index % spawnNodes.length],
    level: config.level,
    shield: config.shield,
    hull: config.hull,
    damagePerHit: config.damagePerHit,
    attackCooldownMs: config.attackCooldownMs,
    image: config.image,
    threat: config.threat,
    visualScale: config.visualScale
  }));
});

const STAGING_RESOURCE_DEFINITIONS = [
  { id: "staging-resource-iron-upper-core-west", resourceName: "Iron", startNode: "Upper Lane Core West", x: 42, y: 35, hp: 30, yield: 12 },
  { id: "staging-resource-copper-upper-core-east", resourceName: "Copper", startNode: "Upper Lane Core East", x: 58, y: 35, hp: 30, yield: 12 },
  { id: "staging-resource-iron-upper-gate", resourceName: "Iron", startNode: "Upper Gate Core", x: 44, y: 45, hp: 32, yield: 14 },
  { id: "staging-resource-crystal-upper-gate-east", resourceName: "Crystal Shards", startNode: "Upper Gate East", x: 78, y: 41, hp: 34, yield: 6 },
  { id: "staging-resource-iron-lower-core-west", resourceName: "Iron", startNode: "Lower Lane Core West", x: 42, y: 65, hp: 30, yield: 12 },
  { id: "staging-resource-copper-lower-core-east", resourceName: "Copper", startNode: "Lower Lane Core East", x: 58, y: 65, hp: 30, yield: 12 },
  { id: "staging-resource-copper-lower-gate", resourceName: "Copper", startNode: "Lower Gate Core", x: 52, y: 55, hp: 34, yield: 8 },
  { id: "staging-resource-crystal-lower-apex", resourceName: "Crystal Shards", startNode: "Lower Apex", x: 50, y: 84, hp: 38, yield: 5 }
];

// Temporary high-yield value for Forge economy testing. Lower this when balancing is complete.
const STAGING_ASTEROID_LUPEN_SHARD_REWARD = 50;

function rollStagingResourceShardReward(resourceName = "") {
  return STAGING_ASTEROID_LUPEN_SHARD_REWARD;
}

export class LupenSectorPlayer extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorPlayer.prototype, "id");
type("string")(LupenSectorPlayer.prototype, "sessionId");
type("string")(LupenSectorPlayer.prototype, "authStatus");
type("string")(LupenSectorPlayer.prototype, "playerId");
type("string")(LupenSectorPlayer.prototype, "supabaseUserId");
type("string")(LupenSectorPlayer.prototype, "trustedPlayerId");
type("boolean")(LupenSectorPlayer.prototype, "authTokenReceived");
type("boolean")(LupenSectorPlayer.prototype, "authVerificationAttempted");
type("string")(LupenSectorPlayer.prototype, "authVerificationReason");
type("string")(LupenSectorPlayer.prototype, "displayName");
type("string")(LupenSectorPlayer.prototype, "guildId");
type("string")(LupenSectorPlayer.prototype, "currentShipId");
type("string")(LupenSectorPlayer.prototype, "shipName");
type("string")(LupenSectorPlayer.prototype, "shipImage");
type("string")(LupenSectorPlayer.prototype, "shipClass");
type("string")(LupenSectorPlayer.prototype, "equippedWeaponKey");
type("string")(LupenSectorPlayer.prototype, "equippedWeaponKeys");
type("string")(LupenSectorPlayer.prototype, "multiplayerMode");
type("string")(LupenSectorPlayer.prototype, "currentNode");
type("string")(LupenSectorPlayer.prototype, "presenceStatus");
type("string")(LupenSectorPlayer.prototype, "selectedTargetBotId");
type("string")(LupenSectorPlayer.prototype, "lastCombatIntentReason");
type("string")(LupenSectorPlayer.prototype, "lastLockOnClearReason");
type("string")(LupenSectorPlayer.prototype, "lastWeaponSourceReason");
type("string")(LupenSectorPlayer.prototype, "lastCombatNodeValidationReason");
type("number")(LupenSectorPlayer.prototype, "activeShipWeaponCount");
type("number")(LupenSectorPlayer.prototype, "validCombatWeaponCount");
type("number")(LupenSectorPlayer.prototype, "rejectedWeaponCount");
type("string")(LupenSectorPlayer.prototype, "firstRejectedWeaponReason");
type("number")(LupenSectorPlayer.prototype, "x");
type("number")(LupenSectorPlayer.prototype, "y");
type("number")(LupenSectorPlayer.prototype, "joinedAt");
type("number")(LupenSectorPlayer.prototype, "lastSeenAt");
type("number")(LupenSectorPlayer.prototype, "lastFireAt");
type("number")(LupenSectorPlayer.prototype, "nextFireAt");
type("number")(LupenSectorPlayer.prototype, "pvpShield");
type("number")(LupenSectorPlayer.prototype, "pvpShieldMax");
type("number")(LupenSectorPlayer.prototype, "pvpArmor");
type("number")(LupenSectorPlayer.prototype, "pvpArmorMax");
type("number")(LupenSectorPlayer.prototype, "pvpHull");
type("number")(LupenSectorPlayer.prototype, "pvpHullMax");
type("number")(LupenSectorPlayer.prototype, "lastPvpHitAt");
type("number")(LupenSectorPlayer.prototype, "lastPvpShieldRegenAt");
type("number")(LupenSectorPlayer.prototype, "nextPvpFireAt");

export class LupenSectorBot extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorBot.prototype, "id");
type("string")(LupenSectorBot.prototype, "botType");
type("string")(LupenSectorBot.prototype, "type");
type("string")(LupenSectorBot.prototype, "name");
type("string")(LupenSectorBot.prototype, "displayName");
type("string")(LupenSectorBot.prototype, "faction");
type("string")(LupenSectorBot.prototype, "image");
type("string")(LupenSectorBot.prototype, "threat");
type("string")(LupenSectorBot.prototype, "currentNode");
type("number")(LupenSectorBot.prototype, "x");
type("number")(LupenSectorBot.prototype, "y");
type("number")(LupenSectorBot.prototype, "level");
type("number")(LupenSectorBot.prototype, "damagePerHit");
type("number")(LupenSectorBot.prototype, "attackCooldownMs");
type("number")(LupenSectorBot.prototype, "visualScale");
type("number")(LupenSectorBot.prototype, "shield");
type("number")(LupenSectorBot.prototype, "shieldMax");
type("number")(LupenSectorBot.prototype, "hull");
type("number")(LupenSectorBot.prototype, "hullMax");
type("number")(LupenSectorBot.prototype, "lastUpdatedAt");
type("number")(LupenSectorBot.prototype, "nextMoveAt");
type("boolean")(LupenSectorBot.prototype, "visualOnly");
type("boolean")(LupenSectorBot.prototype, "disabled");
type("number")(LupenSectorBot.prototype, "disabledUntil");

export class LupenSectorResource extends Schema {
  constructor(values = {}) {
    super();
    Object.assign(this, values);
  }
}

type("string")(LupenSectorResource.prototype, "id");
type("string")(LupenSectorResource.prototype, "resourceName");
type("string")(LupenSectorResource.prototype, "currentNode");
type("number")(LupenSectorResource.prototype, "x");
type("number")(LupenSectorResource.prototype, "y");
type("number")(LupenSectorResource.prototype, "hp");
type("number")(LupenSectorResource.prototype, "hpMax");
type("number")(LupenSectorResource.prototype, "yieldAmount");
type("number")(LupenSectorResource.prototype, "lastUpdatedAt");
type("boolean")(LupenSectorResource.prototype, "depleted");
type("number")(LupenSectorResource.prototype, "depletedUntil");

export class LupenSectorState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.bots = new MapSchema();
    this.resources = new MapSchema();
  }
}

type({ map: LupenSectorPlayer })(LupenSectorState.prototype, "players");
type({ map: LupenSectorBot })(LupenSectorState.prototype, "bots");
type({ map: LupenSectorResource })(LupenSectorState.prototype, "resources");

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStagingTradeWriteBlockReason({
  result = {},
  player = null,
  trustedState = null,
  sellDestinationValid = true
} = {}) {
  const gates = result.gates || {};
  if (result.ok !== true || result.wouldPass !== true) {
    return result.blockReason || result.reason || "trade_validation_failed";
  }
  if (gates.writeEnabled !== true) return "staging_trade_writes_disabled";
  if (gates.dryRun !== false) return "staging_trade_dry_run_enabled";
  if (gates.verified !== true) return "missing_verified_supabase_identity";
  if (gates.allowlisted !== true) {
    if (gates.scopeInvalid === true || gates.scope === "invalid") return "staging_trade_write_scope_invalid";
    if (gates.scope === "disabled") return "staging_trade_write_scope_disabled";
    return gates.scope === "allowlist"
      ? "player_not_in_staging_trade_write_allowlist"
      : "staging_trade_write_gate_not_satisfied";
  }
  if (gates.trustedSaveAvailable !== true || trustedState?.available !== true) {
    return "trusted_player_saves_read_unavailable";
  }
  if (player?.multiplayerMode !== "staging") return "staging_mode_required_for_trade_write";
  if (sellDestinationValid !== true) return "invalid_staging_trade_sell_destination";
  return "staging_trade_write_gate_not_satisfied";
}

function getStagingTradeWriteBlockUserReason(reason = "") {
  const labels = {
    staging_trade_writes_disabled: "Staging trade writes are disabled on the server.",
    staging_trade_dry_run_enabled: "Staging trade dry-run is enabled on the server.",
    missing_verified_supabase_identity: "Verified Supabase identity is missing.",
    player_not_in_staging_trade_write_allowlist: "This verified player is not allowlisted for staging trade writes.",
    staging_trade_write_scope_disabled: "Staging trade write scope is disabled.",
    staging_trade_write_scope_invalid: "Staging trade write scope is invalid.",
    trusted_player_saves_read_unavailable: "Trusted player_saves read is unavailable.",
    staging_mode_required_for_trade_write: "The room join mode is not staging.",
    invalid_staging_trade_sell_destination: "Blocked: wrong sell node.",
    unknown_trade_offer: "Unknown staging trade offer.",
    trade_offer_not_allowed: "This staging trade offer is not allowlisted on the server.",
    invalid_trade_quantity: "Invalid trade quantity.",
    quantity_exceeds_staging_trade_write_limit: "Quantity exceeds the staging trade write limit.",
    insufficient_credits: "Blocked: not enough credits.",
    insufficient_cargo: "Blocked: not enough cargo space.",
    insufficient_resource_cargo: "Blocked: not enough saved cargo to sell.",
    trade_validation_failed: "Staging trade validation failed."
  };
  return labels[reason] || `Staging trade write blocked: ${reason || "unknown reason"}.`;
}

function logStagingTradeWriteBlocked({
  operation = "trade",
  reason = "",
  result = {},
  identity = {},
  player = null,
  offerId = "",
  quantity = 0
} = {}) {
  const gates = result.gates || {};
  console.warn("[lupen staging trade] write blocked", {
    operation,
    reason,
    offerId: getStringValue(offerId),
    quantity: Number(quantity) || 0,
    authStatus: identity.authStatus || "guest",
    trustedPlayerIdPresent: !!identity.trustedPlayerId,
    playerIdPresent: !!identity.playerId,
    roomMode: player?.multiplayerMode || "",
    writeEnabled: gates.writeEnabled === true,
    dryRun: gates.dryRun !== false,
    scope: gates.scope || "",
    requestedScope: gates.requestedScope || "",
    scopeInvalid: gates.scopeInvalid === true,
    allowlisted: gates.allowlisted === true,
    trustedSaveAvailable: gates.trustedSaveAvailable === true,
    currentNode: player?.currentNode || "",
    sellNode: result.sellNode || "",
    sellValidationReason: result.sellValidationReason || "",
    trustedCargo: result.trustedCargo || null,
    costBasisFound: result.costBasisFound === true
  });
}

function getStagingStoreWriteBlockUserReason(reason = "") {
  const labels = {
    staging_store_writes_disabled: "Server purchase is not enabled.",
    staging_store_dry_run_enabled: "Server purchase is not enabled.",
    staging_store_write_scope_disabled: "Server purchase is not enabled.",
    staging_store_write_scope_invalid: "Server purchase failed - invalid Store write scope.",
    verified_identity_required: "Verified staging identity required.",
    staging_store_write_allowlist_missing: "Store write allowlist is missing.",
    player_not_in_staging_store_write_allowlist: "This verified player is not allowlisted for staging Store purchases.",
    staging_mode_required_for_store_write: "The room join mode is not staging.",
    store_item_not_allowed: "Item locked.",
    store_item_preview_only: "Item locked.",
    invalid_store_quantity: "Invalid quantity.",
    unknown_store_item: "Item locked.",
    insufficient_credits: "Not enough credits.",
    store_station_required: "You must be docked at this station.",
    store_station_mismatch: "You must be docked at this station.",
    trusted_save_required: "Server purchase failed - try again.",
    player_save_missing: "Server purchase failed - try again.",
    player_save_read_failed: "Server purchase failed - try again.",
    player_save_patch_failed: "Server purchase failed - try again.",
    store_write_unavailable: "Server purchase failed - try again."
  };
  return labels[reason] || "Server purchase failed - try again.";
}

function logStagingStoreWriteBlocked({
  reason = "",
  preview = {},
  identity = {},
  player = null,
  itemId = "",
  quantity = 0,
  requestedNode = ""
} = {}) {
  const gates = preview.gates || {};
  console.warn("[lupen staging store] purchase blocked", {
    reason,
    itemId: getStringValue(itemId),
    quantity: Number(quantity) || 0,
    authStatus: identity.authStatus || "guest",
    trustedPlayerIdPresent: !!identity.trustedPlayerId,
    playerIdPresent: !!identity.playerId,
    roomMode: player?.multiplayerMode || "",
    writeEnabled: gates.writeEnabled === true,
    dryRun: gates.dryRun === true,
    scope: gates.scope || "",
    requestedScope: gates.requestedScope || "",
    scopeInvalid: gates.scopeInvalid === true,
    allowlisted: gates.allowlisted === true,
    trustedSaveAvailable: gates.trustedSaveAvailable === true,
    itemAllowed: gates.itemAllowed === true,
    currentNode: player?.currentNode || "",
    requestedNode: getStringValue(requestedNode),
    presenceStatus: player?.presenceStatus || ""
  });
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

function getSafePresenceStatus(value = "") {
  const status = getStringValue(value).toLowerCase();
  return status === "docked" ? "docked" : "space";
}

function getMapOnePvpZoneType(nodeId = "") {
  const node = normalizePresenceNode(nodeId);
  if (!node || !KNOWN_SECTOR_NODE_KEYS.has(node)) return "protected";
  if (PVP_CONTESTED_NODE_KEYS.has(node)) return "contested";
  return "protected";
}

function isMapOnePvpContestedNode(nodeId = "") {
  return getMapOnePvpZoneType(nodeId) === "contested";
}

function ensurePlayerPvpState(player) {
  if (!player) return null;
  player.pvpShieldMax = Math.max(1, Math.round(Number(player.pvpShieldMax || player.shieldMax || STAGING_PVP_SHIELD_MAX)));
  player.pvpArmorMax = Math.max(0, Math.round(Number(player.pvpArmorMax || player.armorMax || player.armor || 0)));
  player.pvpHullMax = Math.max(STAGING_PVP_MIN_HULL, Math.round(Number(player.pvpHullMax || STAGING_PVP_HULL_MAX)));
  player.pvpShield = clampNumber(
    Math.round(Number.isFinite(Number(player.pvpShield)) ? Number(player.pvpShield) : player.pvpShieldMax),
    0,
    player.pvpShieldMax
  );
  player.pvpArmor = clampNumber(
    Math.round(Number.isFinite(Number(player.pvpArmor)) ? Number(player.pvpArmor) : player.pvpArmorMax),
    0,
    player.pvpArmorMax
  );
  player.pvpHull = clampNumber(
    Math.round(Number.isFinite(Number(player.pvpHull)) ? Number(player.pvpHull) : player.pvpHullMax),
    0,
    player.pvpHullMax
  );
  player.lastPvpHitAt = Math.max(0, Math.round(Number(player.lastPvpHitAt || 0)));
  player.lastPvpShieldRegenAt = Math.max(0, Math.round(Number(player.lastPvpShieldRegenAt || 0)));
  return player;
}

function updatePlayerPvpCapacityFromPresence(player, message = {}) {
  if (!player) return null;
  ensurePlayerPvpState(player);

  const requestedShieldMax = Number(message.pvpShieldMax ?? message.shieldMax ?? message.maxShield);
  if (Number.isFinite(requestedShieldMax) && requestedShieldMax > 0) {
    const nextShieldMax = clampNumber(Math.round(requestedShieldMax), 1, 10000);
    const previousShieldMax = Number(player.pvpShieldMax || STAGING_PVP_SHIELD_MAX);
    player.pvpShieldMax = nextShieldMax;
    player.pvpShield = previousShieldMax <= STAGING_PVP_SHIELD_MAX && Number(player.lastPvpHitAt || 0) <= 0
      ? nextShieldMax
      : clampNumber(Number(player.pvpShield || 0), 0, nextShieldMax);
  }

  const requestedArmorMax = Number(message.pvpArmorMax ?? message.armorMax ?? message.armor);
  if (Number.isFinite(requestedArmorMax) && requestedArmorMax >= 0) {
    const nextArmorMax = clampNumber(Math.round(requestedArmorMax), 0, 10000);
    const previousArmorMax = Number(player.pvpArmorMax || 0);
    player.pvpArmorMax = nextArmorMax;
    player.pvpArmor = previousArmorMax <= 0 && Number(player.lastPvpHitAt || 0) <= 0
      ? nextArmorMax
      : clampNumber(Number(player.pvpArmor || 0), 0, nextArmorMax);
  }

  const requestedHullMax = Number(message.pvpHullMax ?? message.hullMax ?? message.maxHull);
  if (Number.isFinite(requestedHullMax) && requestedHullMax > 0) {
    const nextHullMax = clampNumber(Math.round(requestedHullMax), STAGING_PVP_MIN_HULL, 10000);
    const previousHullMax = Number(player.pvpHullMax || STAGING_PVP_HULL_MAX);
    player.pvpHullMax = nextHullMax;
    player.pvpHull = previousHullMax <= STAGING_PVP_HULL_MAX && Number(player.lastPvpHitAt || 0) <= 0
      ? nextHullMax
      : clampNumber(Number(player.pvpHull || nextHullMax), 0, nextHullMax);
  }

  return player;
}

function syncPlayerPvpRepairState(player, message = {}, now = Date.now()) {
  if (!player) return null;
  updatePlayerPvpCapacityFromPresence(player, message);
  ensurePlayerPvpState(player);

  const shieldBefore = Number(player.pvpShield || 0);
  const armorBefore = Number(player.pvpArmor || 0);
  const hullBefore = Number(player.pvpHull || STAGING_PVP_MIN_HULL);

  // PvP shields auto-regen in flight, but Hangar repair clears the shared
  // session damage snapshot so stale server values do not override repaired HUDs.
  player.pvpShield = Number(player.pvpShieldMax || STAGING_PVP_SHIELD_MAX);
  player.pvpArmor = Number(player.pvpArmorMax || 0);
  // PvP hull never auto-regens; only the explicit repair flow restores it.
  player.pvpHull = Number(player.pvpHullMax || STAGING_PVP_HULL_MAX);
  player.lastPvpHitAt = 0;
  player.lastPvpShieldRegenAt = now;
  player.lastSeenAt = now;

  return {
    shieldBefore,
    hullBefore,
    shield: player.pvpShield,
    shieldMax: player.pvpShieldMax,
    armorBefore,
    armor: player.pvpArmor,
    armorMax: player.pvpArmorMax,
    hull: player.pvpHull,
    hullMax: player.pvpHullMax,
    hullRepaired: player.pvpHull > hullBefore,
    shieldRestored: player.pvpShield > shieldBefore,
    armorRestored: player.pvpArmor > armorBefore
  };
}

export function applyLayeredPvpDamage(target, damage) {
  if (!target) {
    return {
      damage: 0,
      requestedDamage: 0,
      shieldDamage: 0,
      armorDamage: 0,
      hullDamage: 0,
      shieldBefore: 0,
      shield: 0,
      shieldMax: 0,
      armorBefore: 0,
      armor: 0,
      armorMax: 0,
      hullBefore: 0,
      hull: 0,
      hullMax: STAGING_PVP_MIN_HULL,
      defeated: false
    };
  }

  const requestedDamage = Math.max(0, Math.round(Number(damage || 0)));
  let remaining = requestedDamage;
  const shieldMax = Math.max(0, Math.round(Number(target.pvpShieldMax || target.shieldMax || 0)));
  const armorMax = Math.max(0, Math.round(Number(target.pvpArmorMax || target.armorMax || target.armor || 0)));
  const hullMax = Math.max(STAGING_PVP_MIN_HULL, Math.round(Number(target.pvpHullMax || target.hullMax || STAGING_PVP_HULL_MAX)));
  const shieldBefore = clampNumber(Math.round(Number(target.pvpShield || 0)), 0, shieldMax);
  const armorBefore = clampNumber(Math.round(Number(target.pvpArmor || 0)), 0, armorMax);
  const hullBefore = clampNumber(Math.round(Number.isFinite(Number(target.pvpHull)) ? Number(target.pvpHull) : hullMax), 0, hullMax);

  const shieldDamage = Math.min(shieldBefore, remaining);
  target.pvpShield = Math.max(0, shieldBefore - shieldDamage);
  remaining = Math.max(0, remaining - shieldDamage);

  const armorDamage = Math.min(armorBefore, remaining);
  target.pvpArmor = Math.max(0, armorBefore - armorDamage);
  remaining = Math.max(0, remaining - armorDamage);

  const hullDamage = Math.min(Math.max(0, hullBefore), remaining);
  target.pvpHull = Math.max(0, hullBefore - hullDamage);
  target.pvpShieldMax = shieldMax;
  target.pvpArmorMax = armorMax;
  target.pvpHullMax = hullMax;

  return {
    damage: shieldDamage + armorDamage + hullDamage,
    requestedDamage,
    shieldDamage,
    armorDamage,
    hullDamage,
    shieldBefore,
    shield: target.pvpShield,
    shieldMax: target.pvpShieldMax,
    armorBefore,
    armor: target.pvpArmor,
    armorMax: target.pvpArmorMax,
    hullBefore,
    hull: target.pvpHull,
    hullMax: target.pvpHullMax,
    defeated: target.pvpHull <= 0 && hullBefore > 0
  };
}

export function calculatePrototypePvpDamage() {
  return STAGING_PVP_TEST_DAMAGE;
}

function getPvpEligibilityPreview(attacker = null, target = null, currentNode = "") {
  const node = getStringValue(currentNode || attacker?.currentNode || target?.currentNode);
  const targetId = getStringValue(target?.sessionId || target?.id);
  const attackerId = getStringValue(attacker?.sessionId || attacker?.id);
  if (!attacker) return { allowed: false, reason: "attacker_not_found", pvpEnabled: false };
  if (!target) return { allowed: false, reason: "target_not_found", pvpEnabled: false };
  if (attackerId && targetId && attackerId === targetId) return { allowed: false, reason: "self_target", pvpEnabled: false };
  if (getSafePresenceStatus(attacker?.presenceStatus) === "docked") return { allowed: false, reason: "attacker_docked", pvpEnabled: false };
  if (getSafePresenceStatus(target?.presenceStatus) === "docked") return { allowed: false, reason: "target_docked", pvpEnabled: false };
  const attackerNode = normalizePresenceNode(attacker?.currentNode);
  const targetNode = normalizePresenceNode(target?.currentNode);
  const intentNode = normalizePresenceNode(node);
  if (!attackerNode || !targetNode || attackerNode !== targetNode) return { allowed: false, reason: "not_same_node", pvpEnabled: false };
  if (intentNode && intentNode !== attackerNode) return { allowed: false, reason: "intent_node_mismatch", pvpEnabled: false };
  if (!isMapOnePvpContestedNode(attackerNode)) return { allowed: false, reason: "protected_zone", pvpEnabled: false };
  const attackerGuild = getSafeIdentityValue(attacker?.guildId);
  const targetGuild = getSafeIdentityValue(target?.guildId);
  if (attackerGuild && targetGuild && attackerGuild === targetGuild) return { allowed: false, reason: "guild_ally", pvpEnabled: false };
  return { allowed: true, reason: "contested_zone", pvpEnabled: true };
}

function getSafeWeaponList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => getSafeIdentityValue(item))
    .filter(Boolean)
    .slice(0, 8);
}

function getPvpCombatIntentDiagnostics({
  attacker = null,
  target = null,
  message = {},
  targetPlayerId = "",
  pvpEligibility = null,
  now = Date.now()
} = {}) {
  return {
    pvpIntent: true,
    targetType: getStringValue(message.targetType || "remotePlayer"),
    targetPlayerId: getStringValue(targetPlayerId),
    targetSessionId: getStringValue(target?.sessionId || target?.id || targetPlayerId),
    attackerSessionId: getStringValue(attacker?.sessionId || attacker?.id),
    attackerNode: getStringValue(attacker?.currentNode || message.currentNode),
    targetPlayerNode: getStringValue(target?.currentNode),
    attackerPresenceStatus: getSafePresenceStatus(attacker?.presenceStatus),
    targetPresenceStatus: target ? getSafePresenceStatus(target?.presenceStatus) : "",
    attackerGuildId: getSafeIdentityValue(attacker?.guildId),
    targetGuildId: getSafeIdentityValue(target?.guildId),
    attackerShipId: getSafeIdentityValue(attacker?.currentShipId || attacker?.shipId),
    targetShipId: getSafeIdentityValue(target?.currentShipId || target?.shipId),
    weaponId: getSafeIdentityValue(message.weaponId),
    weaponKey: getSafeIdentityValue(message.weaponKey),
    weaponFamily: getSafeIdentityValue(message.weaponFamily),
    weaponName: getStringValue(message.weaponName || message.weaponLabel).slice(0, 80),
    equippedWeaponKeys: getSafeWeaponList(message.equippedWeaponKeys || message.weaponKeys),
    pvpRulePreview: getStringValue(pvpEligibility?.reason),
    pvpEligibility: pvpEligibility || { allowed: false, reason: "pvp_disabled", pvpEnabled: false },
    pvpDamageApplied: false,
    playerDamageApplied: false,
    mutatedPlayerState: false,
    rewardsGranted: false,
    intentTimestamp: now
  };
}

function getShipImageValue(message = {}) {
  return message.shipImage || message.shipImageSrc || message.shipImagePath || "";
}

function getSafeShipImagePath(value = "") {
  const path = getStringValue(value).replace(/\\/g, "/").slice(0, 160);
  if (!path) return "";
  if (path.includes("..") || path.includes("//")) return "";
  if (!/^assets\/(?:ships|player-ships|hub\/ships)\/[a-z0-9-/.]+\.(?:png|webp|jpg|jpeg)$/i.test(path)) return "";
  return path;
}

function getSafeShipClass(message = {}) {
  return getSafeIdentityValue(message.shipClass || message.shipType || message.shipRole, "").slice(0, 80);
}

function getSafeIdentityValue(value, fallback = "") {
  return getStringValue(value, fallback).slice(0, 120);
}

function normalizeChatChannel(value = "") {
  return "sector";
}

function normalizeChatMessageText(value = "") {
  return getStringValue(value).replace(/\s+/g, " ").slice(0, CHAT_MESSAGE_MAX_LENGTH);
}

function normalizePresenceNode(value = "") {
  return getStringValue(value).toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

export function getPresenceIdentityKey(values = {}) {
  const trustedPlayerId = getSafeIdentityValue(values.trustedPlayerId || values.playerId || "").toLowerCase();
  const supabaseUserId = getSafeIdentityValue(values.supabaseUserId || "").toLowerCase();
  if (trustedPlayerId) return `verified:${trustedPlayerId}`;
  if (supabaseUserId) return `supabase:${supabaseUserId}`;
  return "";
}

function getAuthStatus(options = {}) {
  const requestedStatus = getSafeIdentityValue(options.authStatus, "guest").toLowerCase();

  if (requestedStatus === "verified") return "verified";
  if (requestedStatus === "unverified") return "unverified";
  return "guest";
}

function getSupabaseVerifyConfig(env = process.env) {
  const authApiKey = getStringValue(
    env.SUPABASE_AUTH_VERIFY_API_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    url: getStringValue(env.SUPABASE_URL),
    authApiKey
  };
}

export async function verifySupabaseAccessToken(accessToken, env = process.env, fetchImpl = globalThis.fetch) {
  const token = getStringValue(accessToken);
  if (!token) {
    return {
      authStatus: "guest",
      trustedPlayerId: "",
      supabaseUserId: "",
      displayName: ""
    };
  }

  const config = getSupabaseVerifyConfig(env);
  if (!config.url) {
    return {
      authStatus: "unverified",
      trustedPlayerId: "",
      supabaseUserId: "",
      displayName: "",
      reason: "supabase_url_missing"
    };
  }

  if (!config.authApiKey) {
    return {
      authStatus: "unverified",
      trustedPlayerId: "",
      supabaseUserId: "",
      displayName: "",
      reason: "supabase_auth_apikey_missing"
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      authStatus: "unverified",
      trustedPlayerId: "",
      supabaseUserId: "",
      displayName: "",
      reason: "supabase_verification_unavailable"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_VERIFY_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${config.url.replace(/\/$/, "")}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.authApiKey,
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const status = Number(response.status || 0);
      return {
        authStatus: "unverified",
        trustedPlayerId: "",
        supabaseUserId: "",
        displayName: "",
        reason: status === 401
          ? "supabase_verification_http_401"
          : status === 403
            ? "supabase_verification_http_403"
            : "supabase_token_invalid",
        verificationStatus: status
      };
    }

    const user = await response.json();
    const userId = getSafeIdentityValue(user?.id);
    if (!userId) {
      return {
        authStatus: "unverified",
        trustedPlayerId: "",
        supabaseUserId: "",
        displayName: "",
        reason: "supabase_user_missing"
      };
    }

    return {
      authStatus: "verified",
      trustedPlayerId: userId,
      supabaseUserId: userId,
      displayName: getSafeIdentityValue(user?.user_metadata?.pilot_name || user?.user_metadata?.displayName || user?.user_metadata?.name)
    };
  } catch (_err) {
    return {
      authStatus: "unverified",
      trustedPlayerId: "",
      supabaseUserId: "",
      displayName: "",
      reason: "supabase_verification_failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildRewardWritePlan({
  preview = {},
  claimantIdentity = {},
  contributor = {}
} = {}) {
  const authStatus = getSafeIdentityValue(claimantIdentity.authStatus || contributor.authStatus, "guest");
  const trustedPlayerId = getSafeIdentityValue(claimantIdentity.trustedPlayerId || contributor.trustedPlayerId || claimantIdentity.playerId || contributor.playerId);
  const contributionPercent = clampNumber(Math.round(Number(contributor.percent || 0)), 0, 100);
  const eligible = authStatus === "verified" && !!trustedPlayerId;
  const blockedReason = eligible ? "" : authStatus === "guest" ? "identity_guest" : "identity_unverified";

  return {
    playerId: eligible ? trustedPlayerId : "",
    trustedPlayerId: eligible ? trustedPlayerId : "",
    authStatus,
    displayName: getSafeIdentityValue(claimantIdentity.displayName || contributor.displayName, "Pilot") || "Pilot",
    botId: getSafeIdentityValue(preview.botId),
    botName: getSafeIdentityValue(preview.botName, "Staging Bot") || "Staging Bot",
    node: getSafeIdentityValue(preview.node),
    finalHitBy: getSafeIdentityValue(preview.finalHitBy || preview.disabledBySessionId),
    topContributorSessionId: getSafeIdentityValue(preview.topContributorSessionId),
    contributorSessionId: getSafeIdentityValue(contributor.sessionId || claimantIdentity.sessionId),
    contributionPercent,
    intendedXp: Math.round((Number(preview.previewXp || STAGING_REWARD_DRY_RUN_XP) * contributionPercent) / 100),
    intendedCredits: 0,
    intendedLoot: [],
    lootPreview: preview.lootPreview || null,
    intendedReason: "staging_bot_disabled",
    eligible,
    blockedReason,
    applied: false,
    dryRun: true
  };
}

function getClaimDebugReason({
  ok = true,
  reason = "",
  rewardWritePlan = null,
  rewardApplicationPlan = null,
  rewardApplicationResult = null,
  playerSavePatchPlan = null,
  playerSavePatchResult = null
} = {}) {
  if (rewardApplicationPlan?.eligible === false || rewardWritePlan?.eligible === false) {
    return getSafeIdentityValue(
      rewardApplicationPlan?.blockedReason ||
      rewardWritePlan?.blockedReason ||
      rewardApplicationResult?.skippedReason ||
      "reward_application_not_eligible",
      "reward_application_not_eligible"
    );
  }

  return getSafeIdentityValue(
    playerSavePatchResult?.skippedReason ||
    playerSavePatchPlan?.skippedReason ||
    rewardApplicationResult?.skippedReason ||
    rewardApplicationPlan?.blockedReason ||
    rewardWritePlan?.blockedReason ||
    reason ||
    (ok ? "staging_preview_only" : "claim_rejected"),
    ok ? "staging_preview_only" : "claim_rejected"
  );
}

export function buildRewardClaimStatus({
  ok = true,
  reason = "",
  rewardWritePlan = null,
  rewardLedgerResult = null,
  rewardApplicationPlan = null,
  rewardApplicationResult = null,
  progressionShadowResult = null,
  playerSavePatchPlan = null,
  playerSavePatchResult = null
} = {}) {
  const debugReason = getClaimDebugReason({
    ok,
    reason,
    rewardWritePlan,
    rewardApplicationPlan,
    rewardApplicationResult,
    playerSavePatchPlan,
    playerSavePatchResult
  });
  const verified = rewardWritePlan?.authStatus === "verified" ||
    rewardApplicationPlan?.authStatus === "verified";
  const progressionWritesEnabled = playerSavePatchResult?.progressionWritesEnabled === true ||
    playerSavePatchPlan?.progressionWritesEnabled === true;
  const playerAllowedForStagingWrite = playerSavePatchResult?.playerAllowedForStagingWrite === true ||
    playerSavePatchPlan?.playerAllowedForStagingWrite === true;
  const idempotencyReady = playerSavePatchResult?.idempotencyReady === true ||
    playerSavePatchPlan?.idempotencyReady === true;
  const duplicateDetected = playerSavePatchResult?.duplicateDetected === true ||
    playerSavePatchPlan?.duplicateDetected === true ||
    rewardApplicationResult?.duplicateDetected === true ||
    rewardApplicationPlan?.duplicateDetected === true;
  const rewardWriteAllowed = verified &&
    progressionWritesEnabled &&
    playerAllowedForStagingWrite &&
    idempotencyReady &&
    !duplicateDetected &&
    playerSavePatchPlan?.eligible === true;
  const xpDelta = Math.max(0, Math.round(Number(
    playerSavePatchPlan?.xpDelta ??
    playerSavePatchResult?.plan?.xpDelta ??
    rewardApplicationPlan?.xpDelta ??
    rewardWritePlan?.intendedXp ??
    0
  )));
  const ledgerWritten = !!rewardLedgerResult?.ledgerId;
  const progressionShadowWritten = !!progressionShadowResult?.shadowId;
  const playerSaveWritten = playerSavePatchResult?.applied === true;
  const mode = playerSaveWritten
    ? "reward"
    : !ok || duplicateDetected || !verified || rewardWritePlan?.eligible === false || rewardApplicationPlan?.eligible === false
      ? "blocked"
      : progressionWritesEnabled
        ? "blocked"
        : playerSavePatchPlan || rewardApplicationPlan || rewardWritePlan
          ? "dry_run"
          : "simulated";

  return {
    ok: ok === true,
    mode,
    applied: playerSaveWritten,
    xpDelta,
    reason: playerSaveWritten
      ? "staging_reward_claim_applied"
      : mode === "blocked"
        ? debugReason
      : mode === "dry_run"
          ? "staging_reward_claim_dry_run"
          : "staging_claim_simulated",
    debugReason,
    gates: {
      verified,
      allowlisted: playerAllowedForStagingWrite,
      scope: getSafeIdentityValue(
        playerSavePatchResult?.progressionWriteScope ||
        playerSavePatchPlan?.progressionWriteScope,
        "allowlist"
      ),
      xpWriteAllowed: rewardWriteAllowed,
      rewardWriteAllowed
    },
    ledger: {
      reachable: rewardLedgerResult?.ok === true ||
        ledgerWritten ||
        rewardLedgerResult?.skippedReason === "reward_writes_disabled",
      written: ledgerWritten,
      duplicate: rewardLedgerResult?.skippedReason === "duplicate_reward_ledger"
    },
    progressionShadow: {
      reachable: progressionShadowResult?.ok === true ||
        progressionShadowWritten ||
        progressionShadowResult?.skippedReason === "progression_shadow_writes_disabled",
      written: progressionShadowWritten
    },
    playerSave: {
      attempted: !!playerSavePatchPlan || !!playerSavePatchResult,
      written: playerSaveWritten,
      xpBefore: Number.isFinite(Number(playerSavePatchResult?.xpBefore ?? playerSavePatchPlan?.xpBefore))
        ? Number(playerSavePatchResult?.xpBefore ?? playerSavePatchPlan?.xpBefore)
        : null,
      xpAfter: Number.isFinite(Number(playerSavePatchResult?.xpAfter ?? playerSavePatchPlan?.xpAfter))
        ? Number(playerSavePatchResult?.xpAfter ?? playerSavePatchPlan?.xpAfter)
        : null,
      creditsWritten: false
    }
  };
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

function getSafeWeaponKey(value = "") {
  const key = getStringValue(value);
  return /^[A-Za-z0-9_-]{1,48}$/.test(key) ? key : "";
}

function getWeaponKeysFromValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => getSafeWeaponKey(entry)).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((entry) => getSafeWeaponKey(entry))
    .filter(Boolean);
}

function getStagingEquippedWeaponKeys(message = {}, player = null) {
  const payloadKeys = getWeaponKeysFromValue(message.equippedWeaponKeys);
  const presenceKeys = getWeaponKeysFromValue(player?.equippedWeaponKeys);
  const equippedKeys = payloadKeys.length ? [...payloadKeys] : [...presenceKeys];
  const preferredKey = getSafeWeaponKey(
    message.weaponKey ||
    message.equippedWeaponKey ||
    player?.equippedWeaponKey
  );

  if (preferredKey && !equippedKeys.includes(preferredKey)) equippedKeys.unshift(preferredKey);
  if (!equippedKeys.length) {
    const weaponIdKey = getSafeWeaponKey(message.weaponId);
    if (weaponIdKey) equippedKeys.push(weaponIdKey);
  }

  return equippedKeys.slice(0, STAGING_EQUIPPED_WEAPON_MAX);
}

function getWeaponSourceDebug(message = {}, player = null, selectedKey = "", equippedWeaponKeys = null) {
  const activeKeys = Array.isArray(equippedWeaponKeys)
    ? equippedWeaponKeys
    : getStagingEquippedWeaponKeys(message, player);
  const validKeys = activeKeys.filter((key) => !!STAGING_WEAPON_STATS[key]);
  const rejectedKeys = activeKeys.filter((key) => !STAGING_WEAPON_STATS[key]);
  const fallbackWeaponId = getSafeWeaponKey(message.weaponId);
  const fallbackRejected = fallbackWeaponId && !activeKeys.includes(fallbackWeaponId) && !STAGING_WEAPON_STATS[fallbackWeaponId];
  const firstRejectedWeaponReason = rejectedKeys[0]
    ? `unknown_weapon:${rejectedKeys[0]}`
    : fallbackRejected
      ? `weaponId_not_catalog_weapon:${fallbackWeaponId}`
      : activeKeys.length
        ? ""
        : "no_equipped_weapon_keys";

  return {
    activeShipWeaponCount: activeKeys.length,
    validCombatWeaponCount: validKeys.length,
    rejectedWeaponCount: rejectedKeys.length + (fallbackRejected ? 1 : 0),
    firstRejectedWeaponReason,
    weaponSourceReason: validKeys.length
      ? "catalog_weapon_resolved"
      : selectedKey
        ? "fallback_unknown_weapon"
        : "fallback_no_weapon"
  };
}

function getStagingVolleyWeaponName(weapons = []) {
  const counts = new Map();
  weapons.forEach((weapon) => {
    const name = weapon?.name || "Weapon";
    counts.set(name, Number(counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => count > 1 ? `${name} x${count}` : name)
    .join(" + ");
}

function getRequestedDamageFromPayload(message = {}) {
  const directDamage = Number(message.damage ?? message.weaponDamage);
  return Number.isFinite(directDamage) ? directDamage : 0;
}

function resolveStagingWeapon(message = {}, player = null) {
  const equippedWeaponKeys = getStagingEquippedWeaponKeys(message, player);
  const knownWeapons = equippedWeaponKeys
    .map((key) => STAGING_WEAPON_STATS[key] || null)
    .filter(Boolean);
  const known = knownWeapons[0] || null;
  const weaponKey = known?.key || equippedWeaponKeys[0] || getSafeWeaponKey(message.weaponId);
  const requestedDamage = getRequestedDamageFromPayload(message);
  const debug = getWeaponSourceDebug(message, player, weaponKey, equippedWeaponKeys);

  if (known) {
    const volleyDamage = knownWeapons.reduce((total, weapon) => {
      return total + clampNumber(Math.round(weapon.damage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX);
    }, 0);
    const knownDamage = clampNumber(volleyDamage, STAGING_DAMAGE_MIN, STAGING_VOLLEY_DAMAGE_MAX);
    const combinedDamagePerSecond = knownWeapons.reduce((total, weapon) => {
      const damage = clampNumber(Math.round(weapon.damage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX);
      const cooldownMs = Math.max(1, Number(weapon.cooldownMs || STAGING_FIRE_COOLDOWN_MS));
      return total + (damage * 1000 / cooldownMs);
    }, 0);
    const volleyCooldownMs = combinedDamagePerSecond > 0
      ? Math.round((knownDamage / combinedDamagePerSecond) * 1000)
      : STAGING_FIRE_COOLDOWN_MS;
    const volleyWeaponKeys = knownWeapons.map((weapon) => weapon.key);
    const volleyWeaponCount = knownWeapons.length;
    return {
      weaponKey: known.key,
      weaponName: getStagingVolleyWeaponName(knownWeapons),
      weaponFamily: volleyWeaponCount > 1 ? "volley" : known.family,
      weaponType: volleyWeaponCount > 1 ? "volley" : known.type,
      damage: knownDamage,
      cooldownMs: clampNumber(Math.round(volleyCooldownMs), STAGING_FIRE_COOLDOWN_MIN_MS, STAGING_FIRE_COOLDOWN_MAX_MS),
      damageSource: "server_known_weapon",
      fallbackDamageUsed: false,
      pulseLaserDetected: volleyWeaponKeys.includes("pulseLaser"),
      volleyWeaponCount,
      volleyWeaponKeys,
      requestedDamage,
      clientDamageIgnored: requestedDamage > 0 && Math.round(requestedDamage) !== knownDamage,
      serverAuthoritative: true,
      ...debug,
      weaponSourceReason: "server_known_weapon"
    };
  }

  return {
    weaponKey,
    weaponName: getStringValue(message.weaponName, "Staging Fallback") || "Staging Fallback",
    weaponFamily: getStringValue(message.weaponFamily || message.weaponType || "staging-fallback"),
    weaponType: getStringValue(message.weaponType || message.weaponFamily || "staging-fallback"),
    damage: STAGING_TEST_DAMAGE,
    cooldownMs: STAGING_FIRE_COOLDOWN_MS,
    damageSource: weaponKey ? "fallback_unknown_weapon" : "fallback_no_weapon",
    fallbackDamageUsed: true,
    pulseLaserDetected: false,
    volleyWeaponCount: 0,
    volleyWeaponKeys: [],
    requestedDamage,
    clientDamageIgnored: requestedDamage > 0 && Math.round(requestedDamage) !== STAGING_TEST_DAMAGE,
    serverAuthoritative: true,
    ...debug,
    weaponSourceReason: debug.weaponSourceReason
  };
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

function getNodeCompareResult({ player = null, targetBot = null, clientNode = "", selectedBotId = "" } = {}) {
  const playerServerNode = getStringValue(player?.currentNode);
  const botServerNode = getStringValue(targetBot?.currentNode);
  const combatIntentNode = getStringValue(clientNode);
  if (!playerServerNode) return "player_server_node_missing";
  if (!botServerNode) return selectedBotId ? "selected_bot_missing" : "bot_server_node_missing";
  if (combatIntentNode && combatIntentNode !== playerServerNode && combatIntentNode === botServerNode) {
    return "player_presence_stale_client_matches_bot";
  }
  if (combatIntentNode && combatIntentNode !== playerServerNode) return "client_node_mismatch";
  if (botServerNode !== playerServerNode) return "bot_node_mismatch";
  return "same_node";
}

function getNodeDebugPayload({ message = {}, player = null, targetBot = null } = {}) {
  const combatIntentNode = getStringValue(message.currentNode);
  const selectedBotId = getStringValue(message.targetBotId || player?.selectedTargetBotId);
  const botServerNode = getStringValue(targetBot?.currentNode);
  const playerServerNode = getStringValue(player?.currentNode);
  return {
    playerClientNode: combatIntentNode,
    playerServerNode,
    playerPresenceNode: playerServerNode,
    selectedBotId,
    selectedBotNode: botServerNode,
    botServerNode,
    botVisualNode: botServerNode,
    combatIntentNode,
    nodeCompareResult: getNodeCompareResult({
      player,
      targetBot,
      clientNode: combatIntentNode,
      selectedBotId
    })
  };
}

// Presence-only stepping stone for future server-authoritative multiplayer.
// This room mirrors local player display/location data and server-owned dummy
// bot positions for dev ghosts only. It does not persist state, grant rewards,
// run real combat, or control the real single-player game. Staging combat
// intents may apply tiny server-owned test damage to visual bots and send
// session-only return-fire to engaged clients. The staging bounty wrapper is
// room/session scoped; it never writes normal bounty state, loot, credits,
// PvP, or broad progression.
export class LupenSectorRoom extends Room {
  onCreate() {
    this.setState(new LupenSectorState());
    this.botStep = 0;
    // Preview-only attribution cache for staging reward design. This is kept
    // outside room state so it never becomes player progression, save data,
    // inventory, XP, credits, bounties, or real reward state.
    this.botContributions = new Map();
    // Short-lived staging reward preview cache. Claims against this cache are
    // simulation-only acknowledgements and never mark real rewards as claimed.
    this.rewardPreviews = new Map();
    // In-memory staging duplicate guard for the future player_saves write path.
    // Durable duplicate protection should later use a server-side ledger
    // uniqueness key such as source_event_id before real progression writes.
    this.rewardApplicationIdempotencyKeys = new Set();
    // Separate material-loot idempotency guard. This only protects the
    // staging Lupen Shard write path; durable protection should later move to
    // a Supabase ledger uniqueness key before broader loot writes.
    this.stagingLootClaimIdempotencyKeys = new Set();
    // Room/session scoped staging bounty state. This deliberately does not
    // touch local bounty arrays, Supabase bounty tables, route completion,
    // loot, credits, or normal single-player objective state.
    this.stagingBountyStates = new Map();
    // Session-only return-fire cooldowns for Map 1 staging bots. The room never
    // persists player damage, saves, cargo loss, PvP, credits, loot, or death.
    this.stagingBotReturnFireCooldowns = new Map();
    // Server-owned asteroid/resource mining state for staging. Rewards are
    // authorized once per depletion and applied by the owning browser save path.
    this.stagingResourceMineCooldowns = new Map();
    this.stagingResourcePayoutKeys = new Set();

    this.spawnDummyBots();
    this.spawnStagingResources();
    this.botInterval = this.clock.setInterval(() => {
      this.updateStagingBots();
      this.updateStagingResources();
    }, BOT_MOVE_TICK_MS);
    this.pvpShieldRegenInterval = this.clock.setInterval(() => {
      this.updatePvpShieldRegeneration();
    }, STAGING_PVP_SHIELD_REGEN_TICK_MS);

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

    this.onMessage("pvp:repair", (client, message = {}) => {
      this.syncPvpRepairState(client, message, "pvp:repair");
    });

    this.onMessage("chat:send", (client, message = {}) => {
      this.routeChatMessage(client, message);
    });

    // Staging-only combat intent pipeline. This validates lock-on state against
    // server-owned visual bots, then applies clamped shield-first test damage
    // without granting rewards. Future authoritative combat can replace this
    // response path with real server-side resolution.
    this.onMessage("combat:intent", async (client, message = {}) => {
      await this.resolveCombatIntent(client, message, "combat:intent");
    });

    // Legacy local prototype alias. New clients should send combat:intent.
    this.onMessage("combat_intent", async (client, message = {}) => {
      await this.resolveCombatIntent(client, message, "combat_intent");
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

    this.onMessage("stagingResource:mine", (client, message = {}) => {
      this.resolveResourceMineIntent(client, message, "stagingResource:mine");
    });

    // Staging-only reward flow preparation. This validates a recent preview
    // and replies with applied:false; it never grants XP, credits, loot,
    // inventory, bounties, saves, Supabase writes, or progression.
    this.onMessage("reward:claim_preview", async (client, message = {}) => {
      await this.claimRewardPreview(client, message, "reward:claim_preview");
    });

    this.onMessage("staging:claimRewardPreview", async (client, message = {}) => {
      await this.claimRewardPreview(client, message, "staging:claimRewardPreview");
    });

    // Staging-only material loot path. This is currently limited to
    // save_data.upgradeMaterials.lupenShards and remains disabled/dry-run
    // unless explicit server env gates are opened.
    this.onMessage("stagingLoot:claim", async (client, message = {}) => {
      await this.claimStagingLoot(client, message);
    });

    this.onMessage("stagingBounty:list", (client) => {
      this.sendStagingBountyList(client);
    });

    this.onMessage("stagingBounty:accept", (client, message = {}) => {
      this.acceptStagingBounty(client, message);
    });

    this.onMessage("stagingBounty:status", (client) => {
      this.sendStagingBountyStatus(client);
    });

    this.onMessage("stagingBounty:claim", async (client, message = {}) => {
      await this.claimStagingBounty(client, message);
    });

    // Staging-only trade dry-run endpoints. These preview deterministic
    // server-owned route math without mutating credits, cargo, inventory,
    // player_saves, economy state, Supabase rows, bounties, loot, or rewards.
    this.onMessage("stagingTrade:listOffers", (client) => {
      this.touchPlayer(client.sessionId);
      client.send("stagingTrade:offers", {
        ok: true,
        mode: "dry_run",
        applied: false,
        offers: getStagingTradeOffers(),
        creditsWritten: false,
        cargoWritten: false,
        saveWritten: false,
        reason: "staging_trade_offers",
        receivedAt: Date.now()
      });
    });

    this.onMessage("stagingTrade:preview", async (client, message = {}) => {
      const player = this.touchPlayer(client.sessionId);
      const trustedState = await fetchPlayerTradeValidationState({
        authStatus: player?.authStatus || "guest",
        trustedPlayerId: player?.trustedPlayerId || "",
        playerId: player?.playerId || ""
      });
      const preview = buildStagingTradePreview({
        offerId: message?.offerId,
        quantity: message?.quantity,
        playerSnapshot: message?.playerSnapshot,
        trustedState
      });
      client.send("stagingTrade:previewResult", {
        ...preview,
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
    });

    this.onMessage("stagingTrade:buy", async (client, message = {}) => {
      await this.sendStagingTradeWriteRequest(client, message, "buy");
    });

    this.onMessage("stagingTrade:sell", async (client, message = {}) => {
      await this.sendStagingTradeWriteRequest(client, message, "sell");
    });

    // Staging-only Store preview endpoints. These validate a tiny server-owned
    // Store catalogue and never mutate credits, inventory, equipment, ships,
    // player_saves, bounties, loot, PvP/player damage, or progression.
    this.onMessage("stagingStore:listItems", (client) => {
      this.touchPlayer(client.sessionId);
      client.send("stagingStore:items", {
        ok: true,
        mode: "dry_run",
        applied: false,
        items: getStagingStoreItems(),
        creditsWritten: false,
        inventoryWritten: false,
        shipWritten: false,
        equipmentWritten: false,
        saveWritten: false,
        lootWritten: false,
        bountyWritten: false,
        reason: "staging_store_items",
        receivedAt: Date.now()
      });
    });

    this.onMessage("stagingStore:previewPurchase", async (client, message = {}) => {
      const player = this.touchPlayer(client.sessionId);
      const requestedNode = getStringValue(message?.currentNode)
        || getStringValue(message?.playerSnapshot?.currentNode);
      if (requestedNode && KNOWN_SECTOR_NODES.has(requestedNode) && player?.multiplayerMode === "staging") {
        player.currentNode = requestedNode;
      }
      const requestedPresenceStatus = getStringValue(message?.presenceStatus)
        || getStringValue(message?.playerSnapshot?.presenceStatus);
      if ((requestedPresenceStatus === "docked" || requestedPresenceStatus === "space") && player?.multiplayerMode === "staging") {
        player.presenceStatus = requestedPresenceStatus;
      }
      const trustedState = await fetchPlayerTradeValidationState({
        authStatus: player?.authStatus || "guest",
        trustedPlayerId: player?.trustedPlayerId || "",
        playerId: player?.playerId || ""
      });
      const preview = buildStagingStorePurchasePreview({
        itemId: message?.itemId,
        quantity: message?.quantity,
        playerSnapshot: message?.playerSnapshot,
        trustedState
      });
      client.send("stagingStore:previewResult", {
        ...preview,
        currentNode: player?.currentNode || "",
        requestedNode,
        presenceStatus: player?.presenceStatus || "",
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
    });

    this.onMessage("stagingStore:purchase", async (client, message = {}) => {
      await this.sendStagingStorePurchaseRequest(client, message);
    });

    this.onMessage("stagingLoadout:previewEquip", async (client, message = {}) => {
      await this.sendStagingCargoPodEquipRequest(client, message, false);
    });

    this.onMessage("stagingLoadout:equipAttachment", async (client, message = {}) => {
      await this.sendStagingCargoPodEquipRequest(client, message, true);
    });

    // Legacy local prototype alias. New clients should send movement:update.
    this.onMessage("move", (client, message = {}) => {
      this.applyPresenceUpdate(client, message, "move");
    });
  }

  async onJoin(client, options = {}) {
    const now = Date.now();
    // Server-side Supabase verification groundwork. The access token is read
    // from join options, verified via Supabase when env vars are configured,
    // and never logged, stored in room state, or returned to clients.
    const verifiedIdentity = await verifySupabaseAccessToken(options.supabaseAccessToken);
    const displayName = verifiedIdentity.displayName || getSafeIdentityValue(options.displayName, "Pilot") || "Pilot";
    const trustedPlayerId = verifiedIdentity.trustedPlayerId || "";
    const authTokenReceived = !!getStringValue(options.supabaseAccessToken);
    const replacementIdentityKey = getPresenceIdentityKey({
      trustedPlayerId,
      playerId: trustedPlayerId,
      supabaseUserId: verifiedIdentity.supabaseUserId || trustedPlayerId
    });
    let recoveredPvpState = null;
    if (replacementIdentityKey) {
      this.state.players.forEach((player, sessionId) => {
        if (sessionId === client.sessionId) return;
        if (getPresenceIdentityKey(player) !== replacementIdentityKey) return;
        ensurePlayerPvpState(player);
        recoveredPvpState = {
          pvpShield: player.pvpShield,
          pvpShieldMax: player.pvpShieldMax,
          pvpArmor: player.pvpArmor,
          pvpArmorMax: player.pvpArmorMax,
          pvpHull: player.pvpHull,
          pvpHullMax: player.pvpHullMax,
          lastPvpHitAt: player.lastPvpHitAt,
          lastPvpShieldRegenAt: player.lastPvpShieldRegenAt,
          nextPvpFireAt: player.nextPvpFireAt
        };
        this.broadcast("playerLeft", this.buildPresenceEvent("left", player, {
          reason: "replaced_by_reconnect"
        }));
        this.state.players.delete(sessionId);
        this.stagingBountyStates.delete(sessionId);
        this.clearStagingReturnFireForSession(sessionId);
      });
    }

    const joinedPlayer = new LupenSectorPlayer({
      id: client.sessionId,
      sessionId: client.sessionId,
      // Staging identity is preparation metadata only. Only verified tokens
      // populate trusted ids; unverified/guest clients continue as session
      // based staging participants with no real reward authority.
      authStatus: getAuthStatus(verifiedIdentity),
      playerId: trustedPlayerId,
      supabaseUserId: verifiedIdentity.supabaseUserId || trustedPlayerId,
      trustedPlayerId,
      authTokenReceived,
      authVerificationAttempted: authTokenReceived,
      authVerificationReason: verifiedIdentity.reason || (trustedPlayerId ? "supabase_token_verified" : authTokenReceived ? "supabase_token_unverified" : "supabase_token_missing"),
      displayName,
      guildId: getSafeIdentityValue(options.guildId),
      currentShipId: getSafeIdentityValue(options.currentShipId),
      shipName: getShipName(options),
      shipImage: getSafeShipImagePath(getShipImageValue(options)),
      shipClass: getSafeShipClass(options),
      equippedWeaponKey: getSafeWeaponKey(options.equippedWeaponKey || options.weaponKey),
      equippedWeaponKeys: Array.isArray(options.equippedWeaponKeys)
        ? options.equippedWeaponKeys.map((entry) => getSafeWeaponKey(entry)).filter(Boolean).slice(0, 20).join(",")
        : String(options.equippedWeaponKeys || "").split(",").map((entry) => getSafeWeaponKey(entry)).filter(Boolean).slice(0, 20).join(","),
      multiplayerMode: getSafeIdentityValue(options.multiplayerMode, "dev"),
      currentNode: getStringValue(options.currentNode, "Asteron Prime") || "Asteron Prime",
      presenceStatus: getSafePresenceStatus(options.presenceStatus || options.status),
      selectedTargetBotId: "",
      lastCombatIntentReason: "",
      lastLockOnClearReason: "",
      lastWeaponSourceReason: "",
      lastCombatNodeValidationReason: "",
      activeShipWeaponCount: 0,
      validCombatWeaponCount: 0,
      rejectedWeaponCount: 0,
      firstRejectedWeaponReason: "",
      x: getNumberValue(options.x, 50),
      y: getNumberValue(options.y, 50),
      joinedAt: now,
      lastSeenAt: now,
      lastFireAt: 0,
      nextFireAt: 0,
      // PvP prototype damage is room/session state. Verified reconnects can
      // recover it inside this room, but it is never written to player saves.
      ...(recoveredPvpState || {})
    });
    updatePlayerPvpCapacityFromPresence(joinedPlayer, options);

    if (joinedPlayer.presenceStatus !== "docked") {
      const position = this.allocateOpenSpacePosition(joinedPlayer.currentNode, {
        kind: "player",
        id: client.sessionId
      });
      joinedPlayer.x = position.x;
      joinedPlayer.y = position.y;
    }

    this.state.players.set(client.sessionId, joinedPlayer);
    this.broadcast("playerJoined", this.buildPresenceEvent("joined", joinedPlayer));
  }

  onLeave(client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.broadcast("playerLeft", this.buildPresenceEvent("left", player));
    }
    this.state.players.delete(client.sessionId);
    this.stagingBountyStates.delete(client.sessionId);
    this.clearStagingReturnFireForSession(client.sessionId);
    this.stagingResourceMineCooldowns.delete(client.sessionId);
  }

  onDispose() {
    this.botInterval?.clear?.();
    this.pvpShieldRegenInterval?.clear?.();
  }

  spawnDummyBots() {
    const now = Date.now();

    DUMMY_BOT_DEFINITIONS.forEach((definition, index) => {
      const patrolNode = BOT_NODE_POSITIONS.get(definition.startNode) || STAGING_BOT_NODES[index % STAGING_BOT_NODES.length];
      const position = this.allocateOpenSpacePosition(patrolNode.node, { kind: "bot", id: definition.id });
      this.state.bots.set(definition.id, new LupenSectorBot({
        id: definition.id,
        botType: definition.botType,
        type: definition.type,
        name: definition.name,
        displayName: definition.displayName || definition.name,
        faction: "Erebus",
        image: definition.image,
        threat: definition.threat,
        currentNode: patrolNode.node,
        x: position.x,
        y: position.y,
        level: Number(definition.level || 1),
        damagePerHit: Number(definition.damagePerHit || getErebusBotTypeConfig(definition.botType).damagePerHit),
        attackCooldownMs: Number(definition.attackCooldownMs || getErebusBotTypeConfig(definition.botType).attackCooldownMs),
        visualScale: Number(definition.visualScale || getErebusBotTypeConfig(definition.botType).visualScale),
        shield: Number(definition.shield || 0),
        shieldMax: Number(definition.shield || 0),
        hull: Number(definition.hull || 1),
        hullMax: Number(definition.hull || 1),
        lastUpdatedAt: now,
        nextMoveAt: 0,
        visualOnly: true,
        disabled: false,
        disabledUntil: 0
      }));
    });
  }

  spawnStagingResources() {
    const now = Date.now();

    STAGING_RESOURCE_DEFINITIONS.forEach((definition) => {
      const position = BOT_NODE_POSITIONS.get(definition.startNode) || {
        node: definition.startNode,
        x: definition.x,
        y: definition.y
      };
      const objectPosition = this.allocateOpenSpacePosition(position.node || definition.startNode, {
        kind: "resource",
        id: definition.id
      });
      const hp = Math.max(1, Math.round(Number(definition.hp || 30)));
      this.state.resources.set(definition.id, new LupenSectorResource({
        id: definition.id,
        resourceName: definition.resourceName || "Iron",
        currentNode: position.node || definition.startNode,
        x: objectPosition.x,
        y: objectPosition.y,
        hp,
        hpMax: hp,
        yieldAmount: Math.max(1, Math.round(Number(definition.yield || 10))),
        lastUpdatedAt: now,
        depleted: false,
        depletedUntil: 0
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

      const occupied = this.getOccupiedSpacePositions(bot.currentNode, { kind: "bot", id: bot.id });
      if (!this.isSpacePositionOpen(bot, occupied)) {
        const position = this.allocateOpenSpacePosition(bot.currentNode, { kind: "bot", id: bot.id });
        bot.x = position.x;
        bot.y = position.y;
      }
      bot.lastUpdatedAt = now;
    });

    this.reconcilePlayerSelections();
  }

  updateStagingResources() {
    const now = Date.now();

    this.state.resources.forEach((resource) => {
      if (!resource.depleted) return;
      if (now < Number(resource.depletedUntil || 0)) return;

      const position = this.allocateOpenSpacePosition(resource.currentNode, {
        kind: "resource",
        id: resource.id
      });
      resource.hp = Number(resource.hpMax || 1);
      resource.x = position.x;
      resource.y = position.y;
      resource.depleted = false;
      resource.depletedUntil = 0;
      resource.lastUpdatedAt = now;
      this.broadcast("stagingResource:respawned", {
        ok: true,
        resourceId: resource.id,
        resourceName: resource.resourceName || "Resource",
        currentNode: resource.currentNode,
        hp: resource.hp,
        hpMax: resource.hpMax,
        depleted: false,
        receivedAt: now
      });
    });
  }

  updatePvpShieldRegeneration(now = Date.now()) {
    this.state.players.forEach((player) => {
      ensurePlayerPvpState(player);
      const shieldBefore = Number(player.pvpShield || 0);
      const shieldMax = Number(player.pvpShieldMax || STAGING_PVP_SHIELD_MAX);
      if (shieldBefore >= shieldMax) return;

      const lastHitAt = Number(player.lastPvpHitAt || 0);
      if (!lastHitAt || now - lastHitAt < STAGING_PVP_SHIELD_REGEN_DELAY_MS) return;
      if (now - Number(player.lastPvpShieldRegenAt || 0) < STAGING_PVP_SHIELD_REGEN_TICK_MS) return;

      const shieldAfter = Math.min(shieldMax, shieldBefore + STAGING_PVP_SHIELD_REGEN_AMOUNT);
      if (shieldAfter <= shieldBefore) return;

      player.pvpShield = shieldAfter;
      player.lastPvpShieldRegenAt = now;
      player.lastSeenAt = now;

      this.broadcast("pvp:shield_regen", {
        ok: true,
        reason: "pvp_shield_regenerated",
        targetPlayerId: player.sessionId,
        targetSessionId: player.sessionId,
        targetDisplayName: getSafeIdentityValue(player.displayName, "Pilot") || "Pilot",
        currentNode: player.currentNode,
        shieldBefore,
        shield: player.pvpShield,
        shieldMax: player.pvpShieldMax,
        armor: player.pvpArmor,
        armorMax: player.pvpArmorMax,
        hull: player.pvpHull,
        hullMax: player.pvpHullMax,
        regenAmount: shieldAfter - shieldBefore,
        regenDelayMs: STAGING_PVP_SHIELD_REGEN_DELAY_MS,
        regenTickMs: STAGING_PVP_SHIELD_REGEN_TICK_MS,
        lastPvpShieldRegenAt: player.lastPvpShieldRegenAt,
        hullRegenerated: false,
        deathApplied: false,
        cargoLost: false,
        xpAwarded: false,
        bountyProgressChanged: false,
        rewardsGranted: false,
        serverAuthoritative: true,
        receivedAt: now
      });
    });
  }

  syncPvpRepairState(client, message = {}, messageType = "pvp:repair") {
    const player = this.touchPlayer(client.sessionId);
    if (!player) return;

    const now = Date.now();
    const repairState = syncPlayerPvpRepairState(player, message, now);
    if (!repairState) return;

    this.broadcast("pvp:repair_synced", {
      ok: true,
      reason: "pvp_repair_synced",
      messageType,
      targetPlayerId: player.sessionId,
      targetSessionId: player.sessionId,
      targetDisplayName: getSafeIdentityValue(player.displayName, "Pilot") || "Pilot",
      currentNode: player.currentNode,
      currentShipId: getSafeIdentityValue(player.currentShipId),
      ...repairState,
      deathApplied: false,
      cargoLost: false,
      xpAwarded: false,
      bountyProgressChanged: false,
      rewardsGranted: false,
      serverAuthoritative: true,
      receivedAt: now
    });
  }

  getNextBotNode(currentNode, index = 0) {
    const options = BOT_NODE_LINKS.get(currentNode) || STAGING_BOT_ALLOWED_NODE_IDS;
    const nextNode = options[(this.botStep + index) % options.length] || currentNode || STAGING_BOT_ALLOWED_NODE_IDS[0];
    return STAGING_BOT_ALLOWED_NODE_IDS.includes(nextNode) ? nextNode : STAGING_BOT_ALLOWED_NODE_IDS[0];
  }

  touchPlayer(sessionId) {
    const player = this.state.players.get(sessionId);
    if (player) {
      player.lastSeenAt = Date.now();
      ensurePlayerPvpState(player);
    }
    return player;
  }

  getOccupiedSpacePositions(currentNode = "", exclusion = {}) {
    const nodeKey = normalizePresenceNode(currentNode);
    const excludedKind = String(exclusion.kind || "");
    const excludedId = String(exclusion.id || "");
    const positions = [];
    const addPosition = (kind, id, entity) => {
      if (kind === excludedKind && String(id || "") === excludedId) return;
      if (normalizePresenceNode(entity?.currentNode) !== nodeKey) return;
      const x = Number(entity?.x);
      const y = Number(entity?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      positions.push({ kind, id: String(id || ""), x, y });
    };

    this.state.players.forEach((player, sessionId) => {
      if (getSafePresenceStatus(player?.presenceStatus) === "docked") return;
      addPosition("player", sessionId, player);
    });
    this.state.bots.forEach((bot, botId) => {
      if (bot?.disabled) return;
      addPosition("bot", botId, bot);
    });
    this.state.resources.forEach((resource, resourceId) => {
      if (resource?.depleted) return;
      addPosition("resource", resourceId, resource);
    });

    return positions;
  }

  isSpacePositionOpen(position = {}, occupied = []) {
    const x = Number(position.x);
    const y = Number(position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return !occupied.some((other) => (
      Math.abs(x - Number(other.x || 0)) < SERVER_OBJECT_MIN_GAP_X &&
      Math.abs(y - Number(other.y || 0)) < SERVER_OBJECT_MIN_GAP_Y
    ));
  }

  allocateOpenSpacePosition(currentNode = "", exclusion = {}, random = Math.random) {
    const occupied = this.getOccupiedSpacePositions(currentNode, exclusion);
    const makeCandidate = () => {
      let x = SERVER_OBJECT_SAFE_MIN_X + random() * (SERVER_OBJECT_SAFE_MAX_X - SERVER_OBJECT_SAFE_MIN_X);
      const y = SERVER_OBJECT_SAFE_MIN_Y + random() * (SERVER_OBJECT_SAFE_MAX_Y - SERVER_OBJECT_SAFE_MIN_Y);
      if (y >= SERVER_OBJECT_ACTION_MIN_Y && x >= SERVER_OBJECT_ACTION_MIN_X && x <= SERVER_OBJECT_ACTION_MAX_X) {
        x = random() < 0.5 ? SERVER_OBJECT_ACTION_LEFT_X : SERVER_OBJECT_ACTION_RIGHT_X;
      }
      return {
        x: Math.round(clampNumber(x, SERVER_OBJECT_SAFE_MIN_X, SERVER_OBJECT_SAFE_MAX_X) * 100) / 100,
        y: Math.round(clampNumber(y, SERVER_OBJECT_SAFE_MIN_Y, SERVER_OBJECT_SAFE_MAX_Y) * 100) / 100
      };
    };

    for (let attempt = 0; attempt < SERVER_OBJECT_RANDOM_ATTEMPTS; attempt += 1) {
      const candidate = makeCandidate();
      if (this.isSpacePositionOpen(candidate, occupied)) return candidate;
    }

    const fallbackSlots = [];
    [14, 26, 38, 50, 62, 74, 86].forEach((x) => {
      [14, 31, 48].forEach((y) => {
        if (y >= SERVER_OBJECT_ACTION_MIN_Y && x >= SERVER_OBJECT_ACTION_MIN_X && x <= SERVER_OBJECT_ACTION_MAX_X) return;
        fallbackSlots.push({ x, y, order: random() });
      });
    });
    fallbackSlots.sort((a, b) => a.order - b.order);
    const openFallback = fallbackSlots.find((candidate) => this.isSpacePositionOpen(candidate, occupied));
    if (openFallback) return { x: openFallback.x, y: openFallback.y };

    return fallbackSlots.reduce((best, candidate) => {
      const nearest = occupied.reduce((distance, other) => Math.min(
        distance,
        Math.hypot(candidate.x - Number(other.x || 0), candidate.y - Number(other.y || 0))
      ), Number.POSITIVE_INFINITY);
      return nearest > best.nearest ? { x: candidate.x, y: candidate.y, nearest } : best;
    }, { ...makeCandidate(), nearest: -1 });
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

  buildPresenceEvent(type, player, extra = {}) {
    return {
      type,
      sessionId: player?.sessionId || "",
      displayName: getSafeIdentityValue(player?.displayName, "Pilot") || "Pilot",
      currentNode: player?.currentNode || "",
      presenceStatus: player?.presenceStatus || "space",
      x: Number(player?.x || 0),
      y: Number(player?.y || 0),
      receivedAt: Date.now(),
      ...extra
    };
  }

  sendChatNotice(client, channel, message, reason = "notice") {
    client.send("chat:message", {
      ok: reason === "notice",
      type: "system",
      channel,
      reason,
      message,
      displayName: "System",
      currentNode: this.state.players.get(client.sessionId)?.currentNode || "",
      sessionId: "system",
      receivedAt: Date.now()
    });
  }

  routeChatMessage(client, message = {}) {
    const player = this.touchPlayer(client.sessionId);
    if (!player) {
      this.sendChatNotice(client, "sector", "Chat unavailable while disconnected.", "not_connected");
      return;
    }

    const channel = "sector";
    const text = normalizeChatMessageText(message.message ?? message.text);
    if (!text) {
      this.sendChatNotice(client, channel, "Empty messages cannot be sent.", "empty_message");
      return;
    }

    const payload = {
      ok: true,
      type: "chat",
      id: `${Date.now()}-${client.sessionId}`,
      channel,
      message: text,
      displayName: getSafeIdentityValue(player.displayName, "Pilot") || "Pilot",
      sessionId: client.sessionId,
      playerId: player.trustedPlayerId || player.playerId || "",
      currentNode: player.currentNode || "",
      guildId: player.guildId || "",
      receivedAt: Date.now()
    };

    this.clients.forEach((targetClient) => {
      targetClient.send("chat:message", payload);
    });
  }

  sendTargetRejected(client, reason, messageType, targetBotId = "", message = {}) {
    const player = this.state.players.get(client.sessionId);
    const targetBot = targetBotId ? this.state.bots.get(targetBotId) : null;
    if (player) {
      player.lastLockOnClearReason = reason || "target_rejected";
      player.lastCombatNodeValidationReason = reason || "";
    }
    client.send("target:rejected", {
      ok: false,
      reason,
      lockOnClearReason: reason || "target_rejected",
      combatNodeValidationReason: reason || "",
      ...getNodeDebugPayload({ message: { ...message, targetBotId }, player, targetBot }),
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
    const nodeDebug = getNodeDebugPayload({ message, player, targetBot });

    client.send("combat:rejected", {
      ok: false,
      reason,
      validation,
      combatIntentReason: validation || reason,
      combatNodeValidationReason: validation && validation.includes("node") ? validation : "",
      lockOnClearReason: player?.lastLockOnClearReason || "",
      weaponSourceReason: player?.lastWeaponSourceReason || "not_resolved_intent_rejected",
      activeShipWeaponCount: Number(player?.activeShipWeaponCount || 0),
      validCombatWeaponCount: Number(player?.validCombatWeaponCount || 0),
      rejectedWeaponCount: Number(player?.rejectedWeaponCount || 0),
      firstRejectedWeaponReason: player?.firstRejectedWeaponReason || "",
      ...nodeDebug,
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

  sendResourceMineRejected(client, reason, message = {}, messageType = "stagingResource:mine", extra = {}) {
    const player = this.state.players.get(client.sessionId);
    const resourceId = getStringValue(message.resourceId || message.targetResourceId);
    const resource = resourceId ? this.state.resources.get(resourceId) : null;
    client.send("stagingResource:mineRejected", {
      ok: false,
      reason,
      messageType,
      sessionId: client.sessionId,
      resourceId,
      resourceName: resource?.resourceName || "",
      currentNode: player?.currentNode || getStringValue(message.currentNode) || "",
      resourceNode: resource?.currentNode || "",
      cargoDelta: 0,
      cargoWritten: false,
      saveWritten: false,
      serverAuthoritative: true,
      receivedAt: Date.now(),
      ...extra
    });
  }

  resolveResourceMineIntent(client, message = {}, messageType = "stagingResource:mine") {
    const player = this.touchPlayer(client.sessionId);
    const now = Date.now();
    const resourceId = getStringValue(message.resourceId || message.targetResourceId);
    const resource = resourceId ? this.state.resources.get(resourceId) : null;
    const clientCurrentNode = getStringValue(message.currentNode, player?.currentNode || "");
    let validationReason = "";

    if (!player) validationReason = "session_player_not_found";
    if (!validationReason && !resourceId) validationReason = "missing_resource_id";
    if (!validationReason && !resource) validationReason = `unknown_staging_resource: ${resourceId}`;

    if (!validationReason && clientCurrentNode && clientCurrentNode !== player.currentNode && clientCurrentNode === resource.currentNode) {
      player.currentNode = clientCurrentNode;
    }

    if (!validationReason && clientCurrentNode && clientCurrentNode !== player.currentNode) {
      validationReason = "resource node does not match player node";
    }

    if (!validationReason && resource.currentNode !== player.currentNode) {
      validationReason = "player and staging resource are not in the same node";
    }

    if (!validationReason && resource.depleted) {
      validationReason = "staging_resource_depleted";
    }

    const nextMineAt = Number(this.stagingResourceMineCooldowns.get(client.sessionId) || 0);
    if (!validationReason && nextMineAt > now) {
      this.sendResourceMineRejected(client, "staging_resource_mine_cooldown", message, messageType, {
        cooldownRemainingMs: Math.max(0, Math.ceil(nextMineAt - now))
      });
      return;
    }

    if (validationReason) {
      this.sendResourceMineRejected(client, validationReason, message, messageType);
      return;
    }

    const resolvedWeapon = resolveStagingWeapon(message, player);
    const mineDamage = Math.max(1, Math.round(Number(resolvedWeapon.damage || STAGING_TEST_DAMAGE)));
    const mineCooldownMs = resolvedWeapon.cooldownMs;
    const nextMineAtValue = now + mineCooldownMs;
    const hpBefore = Math.max(0, Number(resource.hp || 0));
    resource.hp = clampNumber(hpBefore - mineDamage, 0, Number(resource.hpMax || 1));
    resource.lastUpdatedAt = now;
    this.stagingResourceMineCooldowns.set(client.sessionId, nextMineAtValue);

    const depleted = resource.hp <= 0;
    let resourceRewardId = "";
    let cargoDelta = 0;
    let lupenShardDelta = 0;

    if (depleted) {
      resource.depleted = true;
      resource.depletedUntil = now + STAGING_RESOURCE_RESPAWN_MS;
      resourceRewardId = `staging_resource:${resource.id}:${resource.depletedUntil}`;
      if (!this.stagingResourcePayoutKeys.has(resourceRewardId)) {
        this.stagingResourcePayoutKeys.add(resourceRewardId);
        cargoDelta = Math.max(1, Math.round(Number(resource.yieldAmount || 1)));
        lupenShardDelta = rollStagingResourceShardReward(resource.resourceName || "");
      }
    }

    const basePayload = {
      ok: true,
      messageType,
      sessionId: client.sessionId,
      minerSessionId: client.sessionId,
      minerDisplayName: player.displayName || "Pilot",
      resourceId: resource.id,
      resourceName: resource.resourceName || "Resource",
      currentNode: resource.currentNode,
      damage: mineDamage,
      hpBefore,
      hp: resource.hp,
      hpMax: resource.hpMax,
      depleted,
      depletedUntil: resource.depletedUntil || 0,
      weaponId: resolvedWeapon.weaponKey,
      weaponKey: resolvedWeapon.weaponKey,
      weaponName: resolvedWeapon.weaponName,
      weaponFamily: resolvedWeapon.weaponFamily,
      volleyWeaponCount: resolvedWeapon.volleyWeaponCount,
      volleyWeaponKeys: resolvedWeapon.volleyWeaponKeys,
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
      clientDamageIgnored: resolvedWeapon.clientDamageIgnored === true,
      serverAuthoritative: true,
      cooldownMs: mineCooldownMs,
      nextMineAt: nextMineAtValue,
      cargoDelta,
      lupenShardDelta,
      cargoWritten: false,
      saveWritten: false,
      localApplySuggested: cargoDelta > 0,
      resourceRewardId,
      rewardsGranted: cargoDelta > 0,
      receivedAt: now
    };

    client.send("stagingResource:mineResult", basePayload);
    this.broadcast("stagingResource:shot", {
      ...basePayload,
      cargoDelta: 0,
      lupenShardDelta: 0,
      rewardsGranted: false,
      resourceRewardId: "",
      timestamp: now
    });

    if (depleted) {
      this.broadcast("stagingResource:depleted", {
        ok: true,
        minerSessionId: client.sessionId,
        minerDisplayName: player.displayName || "Pilot",
        resourceId: resource.id,
        resourceName: resource.resourceName || "Resource",
        currentNode: resource.currentNode,
        hp: resource.hp,
        hpMax: resource.hpMax,
        depleted: true,
        depletedUntil: resource.depletedUntil,
        cargoDelta,
        lupenShardDelta,
        cargoWritten: false,
        saveWritten: false,
        serverAuthoritative: true,
        resourceRewardId,
        receivedAt: now
      });
    }
  }

  selectStagingBot(client, message = {}, messageType = "target:select") {
    const player = this.touchPlayer(client.sessionId);
    const payloadWarning = validateTargetSelectionPayload(message);
    const targetBotId = getStringValue(message.targetBotId);
    const targetBot = targetBotId ? this.state.bots.get(targetBotId) : null;
    const requestedNode = getStringValue(message.currentNode, player?.currentNode || "");

    if (payloadWarning) {
      this.sendTargetRejected(client, payloadWarning, messageType, targetBotId, message);
      return;
    }

    if (!player) {
      this.sendTargetRejected(client, "session player not found", messageType, targetBotId, message);
      return;
    }

    if (!targetBot) {
      this.sendTargetRejected(client, `unknown staging bot: ${targetBotId}`, messageType, targetBotId, message);
      return;
    }

    if (requestedNode && requestedNode !== player.currentNode && requestedNode === targetBot.currentNode) {
      player.currentNode = requestedNode;
      player.lastCombatNodeValidationReason = "player_presence_resynced_to_selected_bot_node";
    }

    if (requestedNode && requestedNode !== player.currentNode) {
      this.sendTargetRejected(client, "selection node does not match player node", messageType, targetBotId, message);
      return;
    }

    if (targetBot.currentNode !== player.currentNode) {
      this.sendTargetRejected(client, "player and staging bot are not in the same node", messageType, targetBotId, message);
      return;
    }

    player.selectedTargetBotId = targetBotId;
    player.lastCombatIntentReason = "target_selected_waiting_for_engage";
    player.lastLockOnClearReason = "";
    player.lastCombatNodeValidationReason = "selection_node_valid";
    const nodeDebug = getNodeDebugPayload({ message, player, targetBot });
    client.send("target:selected", {
      ok: true,
      reason: "lock_on_only_combat_disabled",
      lockOnClearReason: "",
      combatNodeValidationReason: "selection_node_valid",
      ...nodeDebug,
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      currentNode: player.currentNode,
      receivedAt: Date.now()
    });
  }

  clearStagingBotSelection(client, messageType = "target:clear") {
    const player = this.touchPlayer(client.sessionId);
    if (player) {
      player.selectedTargetBotId = "";
      player.lastLockOnClearReason = messageType === "target:clear" ? "client_target_clear_or_disengage" : "selection_cleared";
      player.lastCombatIntentReason = "selection_cleared";
    }
    this.clearStagingReturnFireForSession(client.sessionId);
    client.send("target:selected", {
      ok: true,
      reason: "selection_cleared",
      lockOnClearReason: player?.lastLockOnClearReason || "selection_cleared",
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
    if (!bot) {
      player.lastLockOnClearReason = "selected_bot_missing";
      this.clearStagingReturnFireForSession(player.sessionId);
      player.selectedTargetBotId = "";
      return;
    }
    if (bot.currentNode !== player.currentNode) {
      player.lastLockOnClearReason = "selected_bot_node_mismatch";
      player.lastCombatNodeValidationReason = `bot:${bot.currentNode || "unknown"} player:${player.currentNode || "unknown"}`;
      this.clearStagingReturnFireForSession(player.sessionId);
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

  getBotContributionMap(botId) {
    const safeBotId = getStringValue(botId);
    if (!safeBotId) return null;

    if (!this.botContributions.has(safeBotId)) {
      this.botContributions.set(safeBotId, new Map());
    }

    return this.botContributions.get(safeBotId);
  }

  recordBotContribution(botId, sessionId, damage = 0, now = Date.now()) {
    const safeSessionId = getStringValue(sessionId);
    const safeDamage = Math.max(0, Number(damage || 0));
    const contributionMap = this.getBotContributionMap(botId);

    if (!contributionMap || !safeSessionId || safeDamage <= 0) return;

    const previous = contributionMap.get(safeSessionId) || {
      sessionId: safeSessionId,
      totalDamage: 0,
      hits: 0,
      lastHitAt: 0
    };

    contributionMap.set(safeSessionId, {
      sessionId: safeSessionId,
      totalDamage: previous.totalDamage + safeDamage,
      hits: previous.hits + 1,
      lastHitAt: now
    });
  }

  getPlayerIdentitySnapshot(sessionId) {
    const player = this.state.players.get(getStringValue(sessionId));
    return {
      playerId: player?.playerId || "",
      supabaseUserId: player?.supabaseUserId || player?.playerId || "",
      trustedPlayerId: player?.trustedPlayerId || "",
      displayName: player?.displayName || "Pilot",
      authStatus: player?.authStatus || "guest"
    };
  }

  getContributionSummary(botId) {
    const contributionMap = this.botContributions.get(getStringValue(botId));
    const rawContributors = Array.from(contributionMap?.values?.() || []);
    const totalDamage = rawContributors.reduce((sum, contributor) => {
      return sum + Math.max(0, Number(contributor.totalDamage || 0));
    }, 0);

    const contributors = rawContributors
      .map((contributor) => {
        const contributorDamage = Math.max(0, Number(contributor.totalDamage || 0));
        return {
          sessionId: contributor.sessionId,
          ...this.getPlayerIdentitySnapshot(contributor.sessionId),
          totalDamage: Math.round(contributorDamage * 100) / 100,
          hits: Math.max(0, Number(contributor.hits || 0)),
          lastHitAt: Number(contributor.lastHitAt || 0),
          percent: totalDamage > 0 ? Math.round((contributorDamage / totalDamage) * 100) : 0
        };
      })
      .sort((left, right) => {
        if (right.totalDamage !== left.totalDamage) return right.totalDamage - left.totalDamage;
        return right.lastHitAt - left.lastHitAt;
      });

    return {
      totalDamage: Math.round(totalDamage * 100) / 100,
      topContributorSessionId: contributors[0]?.sessionId || "",
      contributors
    };
  }

  clearBotContributions(botId) {
    this.botContributions.delete(getStringValue(botId));
  }

  getStagingReturnFireKey(sessionId, botId) {
    return `${getStringValue(sessionId)}:${getStringValue(botId)}`;
  }

  clearStagingReturnFireForSession(sessionId) {
    const safeSessionId = getStringValue(sessionId);
    if (!safeSessionId || !this.stagingBotReturnFireCooldowns) return;

    Array.from(this.stagingBotReturnFireCooldowns.keys()).forEach((key) => {
      if (key.startsWith(`${safeSessionId}:`)) {
        this.stagingBotReturnFireCooldowns.delete(key);
      }
    });
  }

  clearStagingReturnFireForBot(botId) {
    const safeBotId = getStringValue(botId);
    if (!safeBotId || !this.stagingBotReturnFireCooldowns) return;

    Array.from(this.stagingBotReturnFireCooldowns.keys()).forEach((key) => {
      if (key.endsWith(`:${safeBotId}`)) {
        this.stagingBotReturnFireCooldowns.delete(key);
      }
    });
  }

  getBotTypePayload(bot) {
    const config = getErebusBotTypeConfig(bot?.botType || bot?.type || "");
    return {
      botType: bot?.botType || config.botType,
      botName: bot?.displayName || bot?.name || config.displayName,
      displayName: bot?.displayName || bot?.name || config.displayName,
      image: bot?.image || config.image,
      threat: bot?.threat || config.threat,
      damagePerHit: Math.max(0, Math.round(Number(bot?.damagePerHit || config.damagePerHit))),
      attackCooldownMs: Math.max(1, Math.round(Number(bot?.attackCooldownMs || config.attackCooldownMs))),
      xpReward: Math.max(0, Math.round(Number(config.xpReward || STAGING_REWARD_DRY_RUN_XP))),
      visualScale: Math.max(0.5, Math.min(1.8, Number(bot?.visualScale || config.visualScale)))
    };
  }

  maybeSendStagingBotReturnFire(client, player, bot, now = Date.now()) {
    if (!client || !player || !bot) return null;
    if (bot.disabled || bot.currentNode !== player.currentNode) return null;
    if (player.selectedTargetBotId !== bot.id) return null;

    const cooldownKey = this.getStagingReturnFireKey(client.sessionId, bot.id);
    const nextAllowedAt = Number(this.stagingBotReturnFireCooldowns.get(cooldownKey) || 0);
    if (nextAllowedAt > now) return null;

    const botTypePayload = this.getBotTypePayload(bot);
    const cooldownMs = botTypePayload.attackCooldownMs;
    const botDamage = botTypePayload.damagePerHit;
    const nextReturnFireAt = now + cooldownMs;
    this.stagingBotReturnFireCooldowns.set(cooldownKey, nextReturnFireAt);

    const payload = {
      ok: true,
      reason: "staging_bot_return_fire",
      sessionId: client.sessionId,
      targetSessionId: client.sessionId,
      targetPlayerId: client.sessionId,
      attackerBotId: bot.id,
      attackerName: botTypePayload.displayName,
      attackerBotType: botTypePayload.botType,
      attackerImage: botTypePayload.image,
      attackerThreat: botTypePayload.threat,
      currentNode: player.currentNode,
      damage: botDamage,
      botDamage,
      damagePerHit: botDamage,
      damageType: "shield_first",
      sessionOnly: true,
      persisted: false,
      saveWritten: false,
      playerDeathEnabled: true,
      cargoLossEnabled: true,
      botAttackStatus: "cooldown",
      botAttackReason: "return_fire_sent",
      cooldownMs,
      nextReturnFireAt,
      receivedAt: now
    };

    this.broadcast("staging:return_fire", payload);
    return payload;
  }

  async applyStagingBotKillXpForPreview(preview = {}) {
    const contributors = Array.isArray(preview.contributors) ? preview.contributors : [];

    await Promise.all(contributors.map(async (contributor) => {
      const sessionId = getStringValue(contributor?.sessionId);
      const targetClient = this.clients.find((candidate) => candidate.sessionId === sessionId);
      if (!sessionId || !targetClient) return;

      const claimantIdentity = {
        sessionId,
        ...this.getPlayerIdentitySnapshot(sessionId)
      };
      const rewardWritePlan = {
        ...buildRewardWritePlan({
          preview,
          claimantIdentity,
          contributor
        }),
        intendedReason: "staging_bot_destroyed"
      };
      const sourceEventId = getStringValue(preview.botXpSourceEventId || preview.destructionInstanceId || preview.rewardPreviewId);
      const rewardApplicationPlan = buildRewardApplicationPlan(rewardWritePlan, {
        sourceEventId
      });
      const rewardApplicationResult = await applyRewardApplicationPlan(rewardApplicationPlan);
      const savePreviewContext = rewardApplicationPlan.eligible
        ? await fetchPlayerSavePreviewContext(rewardApplicationPlan.playerId)
        : {
          ok: false,
          available: false,
          reason: rewardApplicationPlan.blockedReason || "reward_application_not_eligible",
          playerId: rewardApplicationPlan.playerId || "",
          saveSummary: null
        };
      const progressionPreview = buildProgressionPreview(savePreviewContext, rewardApplicationPlan);
      const previewSaveData = progressionPreview.available
        ? {
          credits: progressionPreview.currentCredits,
          playerProgress: {
            combatXp: progressionPreview.currentXp
          }
        }
        : {};
      const idempotencyKey = rewardApplicationPlan.playerId && rewardApplicationPlan.sourceEventId
        ? `${rewardApplicationPlan.playerId}:${rewardApplicationPlan.sourceEventId}`
        : "";
      const duplicateDetected = idempotencyKey ? this.rewardApplicationIdempotencyKeys.has(idempotencyKey) : false;
      const playerSavePatchPlan = buildPlayerSavePatchPlan(previewSaveData, rewardApplicationPlan, {
        sourceEventId,
        duplicateDetected
      });
      const playerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan);
      if (playerSavePatchPlan.idempotencyReady &&
        !playerSavePatchPlan.duplicateDetected &&
        playerSavePatchResult.applied === true) {
        this.rewardApplicationIdempotencyKeys.add(playerSavePatchPlan.idempotencyKey);
      }

      const claimStatus = buildRewardClaimStatus({
        ok: true,
        reason: "staging_bot_kill_xp",
        rewardWritePlan,
        rewardApplicationPlan,
        rewardApplicationResult,
        playerSavePatchPlan,
        playerSavePatchResult
      });

      targetClient.send("stagingXp:botKillResult", {
        ok: true,
        applied: claimStatus.applied === true,
        botXpAttempted: true,
        botXpApplied: claimStatus.applied === true,
        botXpBlockReason: claimStatus.applied === true ? "" : claimStatus.debugReason || playerSavePatchResult.skippedReason || playerSavePatchPlan.skippedReason || "",
        dryRun: claimStatus.applied !== true,
        mode: claimStatus.mode,
        reason: claimStatus.reason,
        debugReason: claimStatus.debugReason,
        botId: getStringValue(preview.botId),
        botType: getStringValue(preview.botType),
        botName: getStringValue(preview.botName, "Staging Bot"),
        displayName: getStringValue(preview.displayName, preview.botName || "Staging Bot"),
        image: getStringValue(preview.image),
        threat: getStringValue(preview.threat),
        damagePerHit: Math.max(0, Math.round(Number(preview.damagePerHit || 0))),
        attackCooldownMs: Math.max(0, Math.round(Number(preview.attackCooldownMs || 0))),
        rewardPreviewId: sourceEventId,
        destructionInstanceId: getStringValue(preview.destructionInstanceId),
        xpDelta: claimStatus.xpDelta,
        xpBefore: playerSavePatchResult.xpBefore ?? playerSavePatchPlan.xpBefore ?? null,
        xpAfter: playerSavePatchResult.xpAfter ?? playerSavePatchPlan.xpAfter ?? null,
        persistedXp: playerSavePatchResult.persistedXp ?? null,
        persistedZoneXp: playerSavePatchResult.persistedZoneXp ?? null,
        persistenceVerified: playerSavePatchResult.persistenceVerified === true,
        idempotencyKey: getStringValue(playerSavePatchResult.idempotencyKey || playerSavePatchPlan.idempotencyKey),
        creditsWritten: false,
        lootWritten: false,
        bountyWritten: false,
        saveWritten: playerSavePatchResult.applied === true,
        gates: claimStatus.gates,
        playerSave: claimStatus.playerSave,
        claimStatus,
        rewardWritePlan,
        rewardApplicationPlan,
        rewardApplicationResult,
        progressionPreview,
        playerSavePatchPlan,
        playerSavePatchResult,
        receivedAt: Date.now()
      });
    }));
  }

  getStagingBountyDestructionKey(bot) {
    const botId = getStringValue(bot?.id);
    if (!botId) return "";
    const disabledUntil = Math.max(0, Math.round(Number(bot?.disabledUntil || 0)));
    const lastUpdatedAt = Math.max(0, Math.round(Number(bot?.lastUpdatedAt || 0)));
    // Bot ids are intentionally stable across respawns. The bounty must count
    // each real server-owned destruction once, so include the disable/update
    // timestamp while still de-duping duplicate messages for the same kill.
    return `${botId}:${disabledUntil || lastUpdatedAt}`;
  }

  buildRewardPreviewPayload(bot, disabledBySessionId, contributionSummary, receivedAt = Date.now(), destructionInstanceId = "") {
    const botId = getStringValue(bot?.id);
    const safeDestructionInstanceId = getStringValue(destructionInstanceId) || `${botId}:${receivedAt}`;
    const botTypePayload = this.getBotTypePayload(bot);
    const finalHitIdentity = this.getPlayerIdentitySnapshot(disabledBySessionId);
    const topContributorIdentity = this.getPlayerIdentitySnapshot(contributionSummary.topContributorSessionId);
    const eligibleSessionIds = (Array.isArray(contributionSummary?.contributors) ? contributionSummary.contributors : [])
      .map((contributor) => getStringValue(contributor?.sessionId))
      .filter(Boolean);
    if (disabledBySessionId) eligibleSessionIds.push(getStringValue(disabledBySessionId));
    const rewardPreviewId = `staging_bot_reward:${safeDestructionInstanceId}`;
    const botXpSourceEventId = `staging_bot_xp:${safeDestructionInstanceId}`;
    const lootPreview = {
      available: false,
      mode: "bot_loot_disabled",
      items: [],
      eligibleSessionIds: Array.from(new Set(eligibleSessionIds)),
      inventoryWritten: false,
      ownedGunsWritten: false,
      ownedAttachmentsWritten: false,
      cargoWritten: false,
      creditsWritten: false,
      bountyWritten: false,
      saveWritten: false,
      reason: "bot_kills_do_not_drop_lupen_shards"
    };
    return {
      ok: true,
      rewardPreviewId,
      botXpSourceEventId,
      destructionInstanceId: safeDestructionInstanceId,
      botId,
      botType: botTypePayload.botType,
      botName: botTypePayload.displayName,
      displayName: botTypePayload.displayName,
      image: botTypePayload.image,
      threat: botTypePayload.threat,
      damagePerHit: botTypePayload.damagePerHit,
      attackCooldownMs: botTypePayload.attackCooldownMs,
      xpReward: botTypePayload.xpReward,
      disabledBySessionId,
      finalHitBy: disabledBySessionId,
      finalHitPlayerId: finalHitIdentity.trustedPlayerId || finalHitIdentity.playerId || finalHitIdentity.supabaseUserId || "",
      finalHitDisplayName: finalHitIdentity.displayName,
      topContributorSessionId: contributionSummary.topContributorSessionId,
      topContributorPlayerId: topContributorIdentity.trustedPlayerId || topContributorIdentity.playerId || topContributorIdentity.supabaseUserId || "",
      topContributorDisplayName: topContributorIdentity.displayName,
      topContributor: contributionSummary.contributors[0] || null,
      contributors: contributionSummary.contributors,
      totalDamage: contributionSummary.totalDamage,
      node: bot?.currentNode || "",
      previewXp: botTypePayload.xpReward,
      previewCredits: STAGING_REWARD_DRY_RUN_CREDITS,
      previewLoot: [],
      lootPreview,
      inventoryWritten: false,
      ownedGunsWritten: false,
      ownedAttachmentsWritten: false,
      cargoWritten: false,
      creditsWritten: false,
      bountyWritten: false,
      saveWritten: false,
      applied: false,
      reason: "staging_preview_only",
      dryRun: true,
      receivedAt
    };
  }

  getStagingBountyState(sessionId) {
    return this.stagingBountyStates.get(getStringValue(sessionId)) || null;
  }

  sendStagingBountyList(client) {
    this.touchPlayer(client.sessionId);
    client.send("stagingBounty:listResult", {
      ok: true,
      mode: "staging_only",
      applied: false,
      bounties: getStagingBounties(),
      active: getPublicStagingBountyState(this.getStagingBountyState(client.sessionId)),
      reason: "staging_bounty_list",
      creditsWritten: false,
      lootWritten: false,
      bountyWritten: false,
      saveWritten: false,
      receivedAt: Date.now()
    });
  }

  acceptStagingBounty(client, message = {}) {
    this.touchPlayer(client.sessionId);
    const bountyId = getStringValue(message.bountyId || STAGING_BOUNTY_ID);
    const bounty = getStagingBountyConfigById(bountyId);
    if (!bounty) {
      client.send("stagingBounty:statusResult", {
        ok: false,
        reason: "unknown_staging_bounty",
        bountyId,
        active: getPublicStagingBountyState(this.getStagingBountyState(client.sessionId)),
        receivedAt: Date.now()
      });
      return;
    }

    const existing = this.getStagingBountyState(client.sessionId);
    if (existing?.claimed && existing.bountyId === bountyId) {
      client.send("stagingBounty:statusResult", {
        ok: true,
        reason: "staging_bounty_already_claimed",
        active: getPublicStagingBountyState(existing),
        receivedAt: Date.now()
      });
      return;
    }

    if (existing?.accepted && !existing.claimed) {
      client.send("stagingBounty:statusResult", {
        ok: true,
        reason: "staging_bounty_already_active",
        active: getPublicStagingBountyState(existing),
        receivedAt: Date.now()
      });
      return;
    }

    const nextState = createStagingBountyState(client.sessionId, Date.now(), bounty.id);
    this.stagingBountyStates.set(client.sessionId, nextState);
    client.send("stagingBounty:statusResult", {
      ok: true,
      reason: "staging_bounty_accepted",
      active: getPublicStagingBountyState(nextState),
      receivedAt: Date.now()
    });
  }

  sendStagingBountyStatus(client, reason = "staging_bounty_status") {
    this.touchPlayer(client.sessionId);
    client.send("stagingBounty:statusResult", {
      ok: true,
      reason,
      active: getPublicStagingBountyState(this.getStagingBountyState(client.sessionId)),
      receivedAt: Date.now()
    });
  }

  updateStagingBountyProgressForDisabledBot(bot, contributionSummary, disabledBySessionId) {
    const contributorSessionIds = (Array.isArray(contributionSummary?.contributors) ? contributionSummary.contributors : [])
      .map((contributor) => getStringValue(contributor?.sessionId))
      .filter(Boolean);
    if (disabledBySessionId) contributorSessionIds.push(getStringValue(disabledBySessionId));
    const uniqueContributors = Array.from(new Set(contributorSessionIds));
    let disabledByResult = null;

    uniqueContributors.forEach((sessionId) => {
      const currentState = this.getStagingBountyState(sessionId);
      const result = recordStagingBountyBotDestruction(currentState, {
        botId: this.getStagingBountyDestructionKey(bot),
        botType: bot?.botType || "",
        botFaction: bot?.faction || "",
        botDisplayName: bot?.displayName || bot?.name || "",
        contributorSessionIds: uniqueContributors,
        now: Date.now()
      });
      if (sessionId === disabledBySessionId) disabledByResult = result;
      if (!result.changed) return;
      this.stagingBountyStates.set(sessionId, result.state);
      const targetClient = this.clients.find((candidate) => candidate.sessionId === sessionId);
      targetClient?.send("stagingBounty:statusResult", {
        ok: true,
        reason: result.reason,
        active: getPublicStagingBountyState(result.state),
        botId: bot?.id || "",
        receivedAt: Date.now()
      });
    });

    return disabledByResult;
  }

  buildStagingBountyRewardWritePlan(client, bountyState) {
    const identity = this.getPlayerIdentitySnapshot(client.sessionId);
    const trustedPlayerId = identity.trustedPlayerId || identity.playerId || identity.supabaseUserId || "";
    const eligible = identity.authStatus === "verified" && !!trustedPlayerId;
    const sourceEventId = buildStagingBountySourceEventId(bountyState, trustedPlayerId || client.sessionId);
    const bounty = getStagingBountyConfigById(bountyState?.bountyId) || STAGING_BOUNTY;
    return {
      playerId: eligible ? trustedPlayerId : "",
      trustedPlayerId: eligible ? trustedPlayerId : "",
      authStatus: identity.authStatus || "guest",
      displayName: identity.displayName || "Pilot",
      botId: bounty.id,
      botName: bounty.title,
      node: this.state.players.get(client.sessionId)?.currentNode || "",
      finalHitBy: client.sessionId,
      topContributorSessionId: client.sessionId,
      contributorSessionId: client.sessionId,
      contributionPercent: 100,
      intendedXp: bounty.xpReward || 0,
      intendedCredits: bounty.creditsReward || 0,
      intendedLoot: Array.isArray(bounty.lootReward) ? bounty.lootReward : [],
      intendedReason: "staging_bounty_completed",
      rewardPreviewId: sourceEventId,
      eligible,
      blockedReason: eligible ? "" : identity.authStatus === "guest" ? "identity_guest" : "identity_unverified",
      applied: false,
      dryRun: true
    };
  }

  async claimStagingBounty(client, message = {}) {
    const player = this.touchPlayer(client.sessionId);
    const bountyId = getStringValue(message.bountyId || STAGING_BOUNTY_ID);
    const bountyState = this.getStagingBountyState(client.sessionId);
    const bounty = getStagingBountyConfigById(bountyId);
    const publicState = getPublicStagingBountyState(bountyState);
    const blockedReason = !player
      ? "session_player_not_found"
      : !bounty
        ? "unknown_staging_bounty"
        : !bountyState?.accepted || bountyState.bountyId !== bountyId
          ? "staging_bounty_not_accepted"
          : bountyState.claimed
            ? "staging_bounty_already_claimed"
            : !publicState.completed
              ? "staging_bounty_not_complete"
              : "";

    if (blockedReason) {
      client.send("stagingBounty:claimResult", {
        ok: false,
        applied: false,
        dryRun: true,
        mode: "blocked",
        reason: blockedReason,
        bounty: publicState,
        creditsWritten: false,
        lootWritten: false,
        bountyWritten: false,
        saveWritten: false,
        receivedAt: Date.now()
      });
      return;
    }

    const rewardWritePlan = this.buildStagingBountyRewardWritePlan(client, bountyState);
    const sourceEventId = rewardWritePlan.rewardPreviewId;
    const rewardLedgerEntry = buildRewardLedgerEntry(rewardWritePlan, {
      roomName: this.roomName || "lupen_sector",
      sourceEventId
    });
    const rewardLedgerResult = await writeRewardLedgerEntry(rewardLedgerEntry);
    const rewardApplicationPlan = buildRewardApplicationPlan(rewardWritePlan, {
      sourceLedgerId: rewardLedgerResult?.ledgerId || "",
      sourceEventId
    });
    const rewardApplicationResult = await applyRewardApplicationPlan(rewardApplicationPlan);
    const savePreviewContext = rewardApplicationPlan.eligible
      ? await fetchPlayerSavePreviewContext(rewardApplicationPlan.playerId)
      : {
        ok: false,
        available: false,
        reason: rewardApplicationPlan.blockedReason || "reward_application_not_eligible",
        playerId: rewardApplicationPlan.playerId || "",
        saveSummary: null
      };
    const progressionPreview = buildProgressionPreview(savePreviewContext, rewardApplicationPlan);
    const progressionShadowEntry = buildProgressionShadowEntry(rewardApplicationPlan, progressionPreview, rewardLedgerResult);
    const progressionShadowResult = await writeProgressionShadowEntry(progressionShadowEntry);
    const previewSaveData = progressionPreview.available
      ? {
        credits: progressionPreview.currentCredits,
        upgradeMaterials: {
          lupenShards: progressionPreview.currentLupenShards
        },
        playerProgress: {
          combatXp: progressionPreview.currentXp
        }
      }
      : {};
    const idempotencyKey = rewardApplicationPlan.playerId && rewardApplicationPlan.sourceEventId
      ? `${rewardApplicationPlan.playerId}:${rewardApplicationPlan.sourceEventId}`
      : "";
    const duplicateDetected = idempotencyKey ? this.rewardApplicationIdempotencyKeys.has(idempotencyKey) : false;
    const playerSavePatchPlan = buildPlayerSavePatchPlan(previewSaveData, rewardApplicationPlan, {
      sourceEventId,
      sourceLedgerId: rewardLedgerResult?.ledgerId || "",
      duplicateDetected
    });
    const playerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan);
    if (playerSavePatchPlan.idempotencyReady &&
      !playerSavePatchPlan.duplicateDetected &&
      playerSavePatchResult.applied === true) {
      this.rewardApplicationIdempotencyKeys.add(playerSavePatchPlan.idempotencyKey);
      bountyState.claimed = true;
      bountyState.claimedAt = Date.now();
      bountyState.updatedAt = bountyState.claimedAt;
      bountyState.lastReason = "claimed";
      this.stagingBountyStates.set(client.sessionId, bountyState);
    }

    const claimStatus = buildRewardClaimStatus({
      ok: true,
      reason: "staging_bounty_claim",
      rewardWritePlan,
      rewardLedgerResult,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult
    });
    const updatedPublicState = getPublicStagingBountyState(this.getStagingBountyState(client.sessionId));
    client.send("stagingBounty:claimResult", {
      ok: true,
      applied: claimStatus.applied === true,
      dryRun: claimStatus.applied !== true,
      mode: claimStatus.mode,
      reason: claimStatus.reason,
      debugReason: claimStatus.debugReason,
      bounty: updatedPublicState,
      xpDelta: claimStatus.xpDelta,
      creditsDelta: rewardApplicationPlan.creditsDelta || 0,
      lupenShardDelta: playerSavePatchPlan.lupenShardDelta || 0,
      creditsWritten: playerSavePatchResult.appliedFields?.includes?.("credits") === true,
      lootWritten: playerSavePatchResult.appliedFields?.includes?.("upgradeMaterials.lupenShards") === true,
      bountyWritten: false,
      saveWritten: playerSavePatchResult.applied === true,
      gates: claimStatus.gates,
      ledger: claimStatus.ledger,
      progressionShadow: claimStatus.progressionShadow,
      playerSave: claimStatus.playerSave,
      claimStatus,
      rewardWritePlan,
      rewardLedgerEntry,
      rewardLedgerResult,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionPreview,
      progressionShadowEntry,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult,
      receivedAt: Date.now()
    });
    this.sendStagingBountyStatus(client, claimStatus.applied ? "staging_bounty_claimed" : "staging_bounty_claim_dry_run");
  }

  sendRewardPreviewRejected(client, reason, message = {}, messageType = "reward:claim_preview") {
    const botId = getStringValue(message.botId);
    const rewardApplicationPlan = buildRewardApplicationPlan({
      authStatus: "guest",
      blockedReason: reason,
      botId,
      rewardPreviewId: getStringValue(message.rewardPreviewId)
    });
    const progressionPreview = buildProgressionPreview({
      available: false,
      reason,
      playerId: ""
    }, rewardApplicationPlan);
    const progressionShadowEntry = buildProgressionShadowEntry(rewardApplicationPlan, progressionPreview, {});
    const progressionShadowResult = {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: reason,
      entry: progressionShadowEntry
    };
    const playerSavePatchPlan = buildPlayerSavePatchPlan({}, rewardApplicationPlan);
    const playerSavePatchResult = {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: false,
      skippedReason: reason,
      plan: playerSavePatchPlan
    };
    const rewardWritePlan = {
      applied: false,
      dryRun: true,
      eligible: false,
      blockedReason: reason,
      intendedXp: 0,
      intendedCredits: 0,
      intendedLoot: [],
      intendedReason: "staging_bot_disabled"
    };
    const rewardApplicationResult = {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: reason,
      plan: rewardApplicationPlan
    };
    const claimStatus = buildRewardClaimStatus({
      ok: false,
      reason,
      rewardWritePlan,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult
    });

    client.send("reward:claim_preview_result", {
      ok: false,
      applied: false,
      mode: claimStatus.mode,
      xpDelta: claimStatus.xpDelta,
      reason,
      debugReason: claimStatus.debugReason,
      messageType,
      sessionId: client.sessionId,
      botId,
      rewardPreviewId: getStringValue(message.rewardPreviewId),
      previewXp: 0,
      previewCredits: 0,
      previewLoot: [],
      gates: claimStatus.gates,
      ledger: claimStatus.ledger,
      progressionShadow: claimStatus.progressionShadow,
      playerSave: claimStatus.playerSave,
      claimStatus,
      rewardWritePlan,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionPreview,
      progressionShadowEntry,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult,
      receivedAt: Date.now()
    });
  }

  async claimRewardPreview(client, message = {}, messageType = "reward:claim_preview") {
    const player = this.touchPlayer(client.sessionId);
    const botId = getStringValue(message.botId);
    const rewardPreviewId = getStringValue(message.rewardPreviewId);
    const preview = botId ? this.rewardPreviews.get(botId) : null;

    if (!player) {
      this.sendRewardPreviewRejected(client, "session player not found", message, messageType);
      return;
    }

    if (!botId || !preview) {
      this.sendRewardPreviewRejected(client, "reward_preview_not_found", message, messageType);
      return;
    }

    if (rewardPreviewId && rewardPreviewId !== preview.rewardPreviewId) {
      this.sendRewardPreviewRejected(client, "reward_preview_id_mismatch", message, messageType);
      return;
    }

    const contributors = Array.isArray(preview.contributors) ? preview.contributors : [];
    const isEligible = preview.finalHitBy === client.sessionId ||
      preview.disabledBySessionId === client.sessionId ||
      preview.topContributorSessionId === client.sessionId ||
      contributors.some((contributor) => contributor?.sessionId === client.sessionId);

    if (!isEligible) {
      this.sendRewardPreviewRejected(client, "reward_preview_not_eligible", message, messageType);
      return;
    }

    const claimantIdentity = {
      sessionId: client.sessionId,
      ...this.getPlayerIdentitySnapshot(client.sessionId)
    };
    const contributor = contributors.find((entry) => entry?.sessionId === client.sessionId) || {};
    const rewardWritePlan = buildRewardWritePlan({
      preview,
      claimantIdentity,
      contributor
    });
    const rewardLedgerEntry = buildRewardLedgerEntry(rewardWritePlan, {
      roomName: this.roomName || "lupen_sector",
      sourceEventId: preview.rewardPreviewId
    });
    const rewardLedgerResult = await writeRewardLedgerEntry(rewardLedgerEntry);
    // Staging-only application preparation. This describes the future
    // progression write but defaults to dry-run/no-write and never mutates
    // player_saves, XP, credits, inventory, bounties, loot, or progression.
    const rewardApplicationPlan = buildRewardApplicationPlan(rewardWritePlan, {
      sourceLedgerId: rewardLedgerResult?.ledgerId || "",
      sourceEventId: preview.rewardPreviewId
    });
    const rewardApplicationResult = await applyRewardApplicationPlan(rewardApplicationPlan);
    const savePreviewContext = rewardApplicationPlan.eligible
      ? await fetchPlayerSavePreviewContext(rewardApplicationPlan.playerId)
      : {
        ok: false,
        available: false,
        reason: rewardApplicationPlan.blockedReason || "reward_application_not_eligible",
        playerId: rewardApplicationPlan.playerId || "",
        saveSummary: null
      };
    const progressionPreview = buildProgressionPreview(savePreviewContext, rewardApplicationPlan);
    const progressionShadowEntry = buildProgressionShadowEntry(
      rewardApplicationPlan,
      progressionPreview,
      rewardLedgerResult
    );
    const progressionShadowResult = await writeProgressionShadowEntry(progressionShadowEntry);
    const previewSaveData = progressionPreview.available
      ? {
        credits: progressionPreview.currentCredits,
        playerProgress: {
          combatXp: progressionPreview.currentXp
        }
      }
      : {};
    const idempotencyKey = rewardApplicationPlan.playerId && rewardApplicationPlan.sourceEventId
      ? `${rewardApplicationPlan.playerId}:${rewardApplicationPlan.sourceEventId}`
      : "";
    const duplicateDetected = idempotencyKey ? this.rewardApplicationIdempotencyKeys.has(idempotencyKey) : false;
    const playerSavePatchPlan = buildPlayerSavePatchPlan(previewSaveData, rewardApplicationPlan, {
      sourceEventId: preview.rewardPreviewId,
      sourceLedgerId: rewardLedgerResult?.ledgerId || "",
      duplicateDetected
    });
    const playerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan);
    if (playerSavePatchPlan.idempotencyReady &&
      !playerSavePatchPlan.duplicateDetected &&
      (playerSavePatchResult.applied === true || playerSavePatchResult.progressionWritesEnabled !== true)) {
      this.rewardApplicationIdempotencyKeys.add(playerSavePatchPlan.idempotencyKey);
    }
    const claimStatus = buildRewardClaimStatus({
      ok: true,
      reason: "staging_preview_only",
      rewardWritePlan,
      rewardLedgerResult,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult
    });

    client.send("reward:claim_preview_result", {
      ...preview,
      ok: true,
      applied: claimStatus.applied === true,
      mode: claimStatus.mode,
      xpDelta: claimStatus.xpDelta,
      dryRun: claimStatus.applied !== true,
      reason: claimStatus.reason,
      debugReason: claimStatus.debugReason,
      messageType,
      sessionId: client.sessionId,
      claimedBySessionId: client.sessionId,
      claimSimulated: claimStatus.applied !== true,
      gates: claimStatus.gates,
      ledger: claimStatus.ledger,
      progressionShadow: claimStatus.progressionShadow,
      playerSave: claimStatus.playerSave,
      claimStatus,
      rewardWritePlan,
      rewardLedgerEntry,
      rewardLedgerResult,
      rewardApplicationPlan,
      rewardApplicationResult,
      progressionPreview,
      progressionShadowEntry,
      progressionShadowResult,
      playerSavePatchPlan,
      playerSavePatchResult,
      receivedAt: Date.now()
    });
  }

  sendStagingLootClaimResult(client, payload = {}) {
    client.send("stagingLoot:claimResult", {
      ok: payload.ok === true,
      applied: payload.applied === true,
      dryRun: payload.dryRun !== false,
      mode: payload.applied === true ? "material_write" : payload.ok === false ? "blocked" : "dry_run",
      reason: getStringValue(payload.reason || payload.skippedReason || (payload.ok === false ? "loot_claim_rejected" : "loot_claim_dry_run")),
      botId: getStringValue(payload.botId),
      botName: getStringValue(payload.botName || "Staging Bot", "Staging Bot"),
      rewardPreviewId: getStringValue(payload.rewardPreviewId),
      lootId: getStringValue(payload.lootId || "lupenShard"),
      lootName: getStringValue(payload.lootName || "Lupen Shard", "Lupen Shard"),
      quantity: Math.max(0, Math.round(Number(payload.quantity || 0))),
      materialKey: getStringValue(payload.materialKey || "upgradeMaterials.lupenShards"),
      materialBefore: Number.isFinite(Number(payload.materialBefore)) ? Number(payload.materialBefore) : null,
      materialAfter: Number.isFinite(Number(payload.materialAfter)) ? Number(payload.materialAfter) : null,
      idempotencyKey: getStringValue(payload.idempotencyKey),
      idempotencyReady: payload.idempotencyReady === true,
      duplicateDetected: payload.duplicateDetected === true,
      gates: payload.gates || null,
      plan: payload.plan || null,
      writeResult: payload.writeResult || null,
      writes: {
        materialWritten: payload.writes?.materialWritten === true,
        inventoryWritten: false,
        ownedGunsWritten: false,
        ownedAttachmentsWritten: false,
        cargoWritten: false,
        creditsWritten: false,
        bountyWritten: false,
        saveWritten: payload.writes?.saveWritten === true
      },
      inventoryWritten: false,
      ownedGunsWritten: false,
      ownedAttachmentsWritten: false,
      cargoWritten: false,
      creditsWritten: false,
      bountyWritten: false,
      saveWritten: payload.writes?.saveWritten === true,
      receivedAt: Date.now()
    });
  }

  async claimStagingLoot(client, message = {}) {
    const player = this.touchPlayer(client.sessionId);
    const botId = getStringValue(message.botId);
    const rewardPreviewId = getStringValue(message.rewardPreviewId);
    const preview = botId ? this.rewardPreviews.get(botId) : null;

    if (!player || !botId || !preview) {
      this.sendStagingLootClaimResult(client, {
        ok: false,
        reason: "reward_preview_not_found",
        botId,
        rewardPreviewId,
        writes: {}
      });
      return;
    }

    if (rewardPreviewId && rewardPreviewId !== preview.rewardPreviewId) {
      this.sendStagingLootClaimResult(client, {
        ok: false,
        reason: "reward_preview_id_mismatch",
        botId,
        botName: preview.botName,
        rewardPreviewId,
        writes: {}
      });
      return;
    }

    const contributors = Array.isArray(preview.contributors) ? preview.contributors : [];
    const eligibleSessionIds = Array.isArray(preview.lootPreview?.eligibleSessionIds)
      ? preview.lootPreview.eligibleSessionIds
      : [];
    const isEligible = preview.finalHitBy === client.sessionId ||
      preview.disabledBySessionId === client.sessionId ||
      preview.topContributorSessionId === client.sessionId ||
      contributors.some((contributor) => contributor?.sessionId === client.sessionId) ||
      eligibleSessionIds.includes(client.sessionId);

    if (!isEligible) {
      this.sendStagingLootClaimResult(client, {
        ok: false,
        reason: "reward_preview_not_eligible",
        botId,
        botName: preview.botName,
        rewardPreviewId: preview.rewardPreviewId,
        writes: {}
      });
      return;
    }

    const requestedLootId = getStringValue(message.lootId || "preview:lupenShard");
    const lootItem = (Array.isArray(preview.lootPreview?.items) ? preview.lootPreview.items : [])
      .find((item) => getStringValue(item?.lootId) === requestedLootId) ||
      (requestedLootId === "lupenShard"
        ? { lootId: "preview:lupenShard", name: "Lupen Shard", quantity: 1 }
        : null);

    if (!lootItem || !["preview:lupenShard", "lupenShard"].includes(getStringValue(lootItem.lootId))) {
      this.sendStagingLootClaimResult(client, {
        ok: false,
        reason: "loot_item_not_allowed",
        botId,
        botName: preview.botName,
        rewardPreviewId: preview.rewardPreviewId,
        lootId: requestedLootId,
        lootName: lootItem?.name || "Preview Loot",
        writes: {}
      });
      return;
    }

    const identity = this.getPlayerIdentitySnapshot(client.sessionId);
    const duplicateProbe = buildStagingLootClaimPlan({
      player: {
        ...identity,
        sessionId: client.sessionId
      },
      preview,
      lootId: lootItem.lootId,
      quantity: lootItem.quantity || 1,
      duplicateDetected: false
    });
    const duplicateDetected = duplicateProbe.idempotencyKey
      ? this.stagingLootClaimIdempotencyKeys.has(duplicateProbe.idempotencyKey)
      : false;
    const plan = buildStagingLootClaimPlan({
      player: {
        ...identity,
        sessionId: client.sessionId
      },
      preview,
      lootId: lootItem.lootId,
      quantity: lootItem.quantity || 1,
      duplicateDetected
    });
    const writeResult = await applyStagingLootClaimWrite(plan);

    if (writeResult.applied === true && plan.idempotencyKey) {
      this.stagingLootClaimIdempotencyKeys.add(plan.idempotencyKey);
    }

    this.sendStagingLootClaimResult(client, {
      ok: writeResult.ok === true,
      applied: writeResult.applied === true,
      dryRun: writeResult.dryRun !== false,
      reason: writeResult.skippedReason || (writeResult.applied ? "lupen_shard_claim_applied" : "loot_claim_dry_run"),
      botId,
      botName: preview.botName,
      rewardPreviewId: preview.rewardPreviewId,
      lootId: plan.lootId,
      lootName: lootItem.name || "Lupen Shard",
      quantity: plan.quantity,
      materialKey: writeResult.materialKey || "upgradeMaterials.lupenShards",
      materialBefore: writeResult.materialBefore,
      materialAfter: writeResult.materialAfter,
      idempotencyKey: plan.idempotencyKey,
      idempotencyReady: plan.idempotencyReady,
      duplicateDetected: writeResult.duplicateDetected === true || plan.duplicateDetected === true,
      gates: writeResult.gates,
      plan,
      writeResult,
      writes: writeResult.writes || {}
    });
  }

  async sendStagingTradeWriteRequest(client, message = {}, operation = "buy") {
    const player = this.touchPlayer(client.sessionId);
    const identity = {
      authStatus: player?.authStatus || "guest",
      trustedPlayerId: player?.trustedPlayerId || "",
      playerId: player?.playerId || ""
    };
    const trustedState = await fetchPlayerTradeValidationState({
      authStatus: identity.authStatus,
      trustedPlayerId: identity.trustedPlayerId,
      playerId: identity.playerId
    });
    const result = buildStagingTradeWriteDryRun({
      operation,
      offerId: message?.offerId,
      quantity: message?.quantity,
      playerSnapshot: message?.playerSnapshot,
      trustedState,
      identity
    });

    const offer = getStagingTradeOfferById(message?.offerId);
    const requestedNode = getStringValue(message?.currentNode)
      || getStringValue(message?.playerSnapshot?.currentNode);
    if (requestedNode && KNOWN_SECTOR_NODES.has(requestedNode) && player?.multiplayerMode === "staging") {
      player.currentNode = requestedNode;
    }
    const playerNode = String(player?.currentNode || "");
    const sellDestinationValid = operation !== "sell" || (offer?.sellNode && playerNode === offer.sellNode);

    // Phase 5b/5d writes are only attempted after every staging gate is
    // explicit. Sell additionally requires the player's server presence node
    // to match the server offer's sell destination.
    const canAttemptBuyWrite = operation === "buy" &&
      result.ok === true &&
      result.wouldPass === true &&
      result.gates?.writeEnabled === true &&
      result.gates?.dryRun === false &&
      result.gates?.verified === true &&
      result.gates?.allowlisted === true &&
      result.gates?.trustedSaveAvailable === true &&
      player?.multiplayerMode === "staging";
    const canAttemptSellWrite = operation === "sell" &&
      result.ok === true &&
      result.wouldPass === true &&
      result.gates?.writeEnabled === true &&
      result.gates?.dryRun === false &&
      result.gates?.verified === true &&
      result.gates?.allowlisted === true &&
      result.gates?.trustedSaveAvailable === true &&
      player?.multiplayerMode === "staging" &&
      sellDestinationValid;
    const stagingModeBlockedWrite = (operation === "buy" || operation === "sell") &&
      result.ok === true &&
      result.wouldPass === true &&
      result.gates?.writeEnabled === true &&
      result.gates?.dryRun === false &&
      player?.multiplayerMode !== "staging";
    const sellDestinationBlocked = operation === "sell" &&
      result.ok === true &&
      result.wouldPass === true &&
      result.gates?.writeEnabled === true &&
      result.gates?.dryRun === false &&
      player?.multiplayerMode === "staging" &&
      !sellDestinationValid;

    if (canAttemptBuyWrite) {
      const writeResult = await applyStagingTradeBuyWrite({
        playerId: identity.trustedPlayerId || identity.playerId,
        offer,
        quantity: message?.quantity,
        trustedState
      });
      if (writeResult?.applied !== true) {
        logStagingTradeWriteBlocked({
          operation,
          reason: writeResult?.reason || writeResult?.debugReason || "staging_trade_write_failed",
          result,
          identity,
          player,
          offerId: message?.offerId,
          quantity: message?.quantity
        });
      }

      client.send("stagingTrade:buyResult", {
        ...result,
        ...writeResult,
        gates: result.gates,
        validationMode: result.validationMode,
        trustedStateAvailable: result.trustedStateAvailable,
        snapshotUsed: result.snapshotUsed,
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
      return;
    }

    if (canAttemptSellWrite) {
      const writeResult = await applyStagingTradeSellWrite({
        playerId: identity.trustedPlayerId || identity.playerId,
        offer,
        quantity: message?.quantity,
        trustedState
      });
      if (writeResult?.applied !== true) {
        logStagingTradeWriteBlocked({
          operation,
          reason: writeResult?.reason || writeResult?.debugReason || "staging_trade_write_failed",
          result,
          identity,
          player,
          offerId: message?.offerId,
          quantity: message?.quantity
        });
      }

      client.send("stagingTrade:sellResult", {
        ...result,
        ...writeResult,
        gates: result.gates,
        validationMode: result.validationMode,
        trustedStateAvailable: result.trustedStateAvailable,
        snapshotUsed: result.snapshotUsed,
        writeHandlerUsed: "applyStagingTradeSellWrite",
        dryRunEnv: result.gates?.dryRun !== false,
        sellValidationReason: writeResult?.reason || writeResult?.debugReason || result.sellValidationReason || "sell_write_attempted",
        trustedCargo: result.trustedCargo || null,
        costBasisFound: result.costBasisFound === true,
        currentNode: playerNode,
        sellNode: offer?.sellNode || "",
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
      return;
    }

    const writeBlockReason = getStagingTradeWriteBlockReason({
      result,
      player,
      trustedState,
      sellDestinationValid
    });
    const writeBlockUserReason = getStagingTradeWriteBlockUserReason(writeBlockReason);
    logStagingTradeWriteBlocked({
      operation,
      reason: writeBlockReason,
      result,
      identity,
      player,
      offerId: message?.offerId,
      quantity: message?.quantity
    });

    client.send(`stagingTrade:${operation}Result`, {
      ...result,
      reason: stagingModeBlockedWrite
        ? "staging_mode_required_for_trade_write"
        : sellDestinationBlocked
          ? "invalid_staging_trade_sell_destination"
          : writeBlockReason,
      debugReason: stagingModeBlockedWrite
        ? "client_join_mode_was_not_staging"
        : sellDestinationBlocked
          ? `player_node_${playerNode || "unknown"}_does_not_match_${offer?.sellNode || "unknown"}`
          : writeBlockReason,
      blockReason: writeBlockReason,
      writeBlockReason,
      writeHandlerUsed: "preflight",
      dryRunEnv: result.gates?.dryRun !== false,
      sellValidationReason: operation === "sell"
        ? (sellDestinationBlocked ? "sell_destination_mismatch" : result.sellValidationReason || writeBlockReason)
        : undefined,
      trustedCargo: result.trustedCargo || null,
      costBasisFound: result.costBasisFound === true,
      currentNode: playerNode,
      sellNode: offer?.sellNode || "",
      userReason: writeBlockUserReason,
      sessionId: client.sessionId,
      receivedAt: Date.now()
    });
  }

  async sendStagingStorePurchaseRequest(client, message = {}) {
    const player = this.touchPlayer(client.sessionId);
    const identity = {
      authStatus: player?.authStatus || "guest",
      trustedPlayerId: player?.trustedPlayerId || "",
      playerId: player?.playerId || ""
    };
    const itemId = getStringValue(message?.itemId);
    const item = getStagingStoreItemById(itemId);
    const requestedQuantity = Number(message?.quantity);
    const storeWriteQuantityValid = Number.isFinite(requestedQuantity) && Math.floor(requestedQuantity) === 1;
    const requestedNode = getStringValue(message?.currentNode)
      || getStringValue(message?.playerSnapshot?.currentNode);
    if (requestedNode && KNOWN_SECTOR_NODES.has(requestedNode) && player?.multiplayerMode === "staging") {
      player.currentNode = requestedNode;
    }
    const requestedPresenceStatus = getStringValue(message?.presenceStatus)
      || getStringValue(message?.playerSnapshot?.presenceStatus);
    if ((requestedPresenceStatus === "docked" || requestedPresenceStatus === "space") && player?.multiplayerMode === "staging") {
      player.presenceStatus = requestedPresenceStatus;
    }
    const playerNode = getStringValue(player?.currentNode);
    const playerPresenceStatus = getStringValue(player?.presenceStatus || "space");
    const stationValid = playerPresenceStatus === "docked" && !!playerNode;
    const trustedState = await fetchPlayerTradeValidationState({
      authStatus: identity.authStatus,
      trustedPlayerId: identity.trustedPlayerId,
      playerId: identity.playerId
    });
    const preview = buildStagingStorePurchasePreview({
      itemId,
      quantity: message?.quantity,
      playerSnapshot: message?.playerSnapshot,
      trustedState
    });
    const envGate = getStoreWriteEnvGate(identity.trustedPlayerId || identity.playerId, itemId);
    const gates = {
      verified: identity.authStatus === "verified" && !!(identity.trustedPlayerId || identity.playerId),
      writeEnabled: envGate.writeEnabled,
      dryRun: envGate.dryRun,
      allowlisted: envGate.playerAllowed,
      scope: envGate.scope,
      requestedScope: envGate.requestedScope,
      scopeInvalid: envGate.scopeInvalid === true,
      trustedSaveAvailable: trustedState?.available === true,
      itemAllowed: envGate.itemAllowed
    };

    const baseResult = {
      ...preview,
      operation: "purchase",
      gates,
      writes: {
        creditsWritten: false,
        inventoryWritten: false,
        attachmentWritten: false,
        equipmentWritten: false,
        shipWritten: false,
        weaponWritten: false,
        saveWritten: false,
        lootWritten: false,
        bountyWritten: false
      },
      creditsWritten: false,
      inventoryWritten: false,
      attachmentWritten: false,
      equipmentWritten: false,
      shipWritten: false,
      weaponWritten: false,
      saveWritten: false,
      lootWritten: false,
      bountyWritten: false,
      currentNode: playerNode,
      requestedNode,
      presenceStatus: playerPresenceStatus,
      sessionId: client.sessionId,
      receivedAt: Date.now()
    };

    const canAttemptWrite = preview.ok === true &&
      preview.wouldPass === true &&
      STAGING_STORE_WRITE_ITEM_IDS.has(item?.itemId) &&
      storeWriteQuantityValid &&
      gates.writeEnabled === true &&
      gates.dryRun === false &&
      gates.verified === true &&
      gates.allowlisted === true &&
      gates.trustedSaveAvailable === true &&
      gates.itemAllowed === true &&
      stationValid &&
      player?.multiplayerMode === "staging";

    if (canAttemptWrite) {
      const writeResult = await applyStagingStorePurchaseWrite({
        playerId: identity.trustedPlayerId || identity.playerId,
        itemId,
        quantity: message?.quantity,
        trustedState
      });
      if (writeResult?.applied !== true) {
        logStagingStoreWriteBlocked({
          reason: writeResult?.blockReason || writeResult?.reason || writeResult?.debugReason || "store_write_unavailable",
          preview: { ...preview, gates },
          identity,
          player,
          itemId,
          quantity: message?.quantity,
          requestedNode
        });
      }

      client.send("stagingStore:purchaseResult", {
        ...baseResult,
        ...writeResult,
        gates,
        validationMode: writeResult.validationMode || preview.validationMode,
        trustedStateAvailable: true,
        snapshotUsed: false,
        userReason: writeResult.applied === true
          ? ""
          : writeResult.userReason || getStagingStoreWriteBlockUserReason(writeResult.blockReason || writeResult.reason),
        currentNode: playerNode,
        requestedNode,
        presenceStatus: playerPresenceStatus,
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
      return;
    }

    let previewOnlyReason = preview.blockReason || "store_write_unavailable";
    if (!storeWriteQuantityValid) {
      previewOnlyReason = "invalid_store_quantity";
    } else if (item && !STAGING_STORE_WRITE_ITEM_IDS.has(item.itemId)) {
      previewOnlyReason = "store_item_preview_only";
    } else if (player?.multiplayerMode !== "staging" && gates.writeEnabled && !gates.dryRun) {
      previewOnlyReason = "staging_mode_required_for_store_write";
    } else if (!gates.writeEnabled) {
      previewOnlyReason = "staging_store_writes_disabled";
    } else if (gates.dryRun) {
      previewOnlyReason = "staging_store_dry_run_enabled";
    } else if (!gates.verified) {
      previewOnlyReason = "verified_identity_required";
    } else if (!gates.allowlisted) {
      previewOnlyReason = envGate.scopeInvalid
        ? "staging_store_write_scope_invalid"
        : envGate.scope === "disabled"
          ? "staging_store_write_scope_disabled"
          : envGate.scope === "allowlist" && !envGate.allowlistPresent
            ? "staging_store_write_allowlist_missing"
            : "player_not_in_staging_store_write_allowlist";
    } else if (!gates.itemAllowed) {
      previewOnlyReason = "store_item_not_allowed";
    } else if (!stationValid) {
      previewOnlyReason = "store_station_required";
    }
    logStagingStoreWriteBlocked({
      reason: previewOnlyReason,
      preview: { ...preview, gates },
      identity,
      player,
      itemId,
      quantity: message?.quantity,
      requestedNode
    });

    client.send("stagingStore:purchaseResult", {
      ...baseResult,
      ok: preview.ok === true && previewOnlyReason === "staging_store_dry_run_enabled",
      mode: previewOnlyReason === "staging_store_dry_run_enabled" ? "dry_run" : "blocked",
      applied: false,
      dryRun: true,
      blockReason: previewOnlyReason === "invalid_store_quantity" ? "invalid_store_quantity" : preview.blockReason || previewOnlyReason,
      reason: previewOnlyReason,
      userReason: item && !STAGING_STORE_WRITE_ITEM_IDS.has(item.itemId)
        ? getStagingStoreWriteBlockUserReason("store_item_preview_only")
        : getStagingStoreWriteBlockUserReason(preview.blockReason || previewOnlyReason),
      currentNode: playerNode,
      requestedNode,
      presenceStatus: playerPresenceStatus,
      receivedAt: Date.now()
    });
  }

  async sendStagingCargoPodEquipRequest(client, message = {}, wantsWrite = false) {
    const player = this.touchPlayer(client.sessionId);
    const identity = {
      authStatus: player?.authStatus || "guest",
      trustedPlayerId: player?.trustedPlayerId || "",
      playerId: player?.playerId || ""
    };
    const itemId = getStringValue(message?.itemId || "attachment:cargoPod");
    const operation = getStringValue(message?.operation || "equip") === "unequip" ? "unequip" : "equip";
    const inventorySource = getStringValue(message?.inventorySource || message?.source || "");
    const inventoryItemId = getStringValue(message?.inventoryItemId || message?.inventoryId || "");
    const quality = getStringValue(message?.quality || "standard") || "standard";
    const level = Number.isFinite(Number(message?.level)) ? Math.max(1, Math.min(99, Math.floor(Number(message.level)))) : 1;
    const slotIndex = Number.isFinite(Number(message?.slotIndex)) ? Math.max(0, Math.floor(Number(message.slotIndex))) : null;
    const loadoutOptions = { itemId, inventorySource, inventoryItemId, quality, level, slotIndex };
    const trustedState = await fetchPlayerTradeValidationState({
      authStatus: identity.authStatus,
      trustedPlayerId: identity.trustedPlayerId,
      playerId: identity.playerId
    });
    const envGate = getLoadoutWriteEnvGate(identity.trustedPlayerId || identity.playerId, itemId);
    const stagingWeaponKey = itemId.startsWith("gun:") ? itemId.slice(4) : "";
    const stagingWeapon = stagingWeaponKey ? STAGING_WEAPON_STATS[stagingWeaponKey] : null;
    const stagingShipKey = itemId.startsWith("ship:") ? itemId.slice(5) : "";
    const stagingShip = stagingShipKey ? STAGING_SHIP_CONFIG[stagingShipKey] : null;
    const baseName = stagingShip?.name || stagingWeapon?.name || (itemId === "attachment:shieldBooster" ? "Shield Booster" : itemId === "attachment:cargoPod" ? "Cargo Pod" : "");
    const baseCategory = itemId.startsWith("ship:")
      ? "ship"
      : itemId.startsWith("gun:")
        ? "weapon"
        : "equipment";
    const gates = {
      verified: identity.authStatus === "verified" && !!(identity.trustedPlayerId || identity.playerId),
      writeEnabled: envGate.writeEnabled,
      dryRun: envGate.dryRun,
      allowlisted: envGate.playerAllowed,
      scope: envGate.scope,
      requestedScope: envGate.requestedScope,
      scopeInvalid: envGate.scopeInvalid === true,
      trustedSaveAvailable: trustedState?.available === true,
      itemAllowed: envGate.itemAllowed
    };
    const base = {
      ok: false,
      mode: "blocked",
      operation,
      applied: false,
      dryRun: true,
      itemId,
      name: baseName,
      category: baseCategory,
      validationMode: trustedState?.available ? "trusted_save" : "unknown",
      trustedStateAvailable: trustedState?.available === true,
      gates,
      writes: {
        loadoutWritten: false,
        attachmentWritten: false,
        inventoryWritten: false,
        creditsWritten: false,
        shipWritten: false,
        weaponWritten: false,
        saveWritten: false
      },
      loadoutWritten: false,
      attachmentWritten: false,
      inventoryWritten: false,
      creditsWritten: false,
      shipWritten: false,
      weaponWritten: false,
      saveWritten: false,
      sessionId: client.sessionId,
      receivedAt: Date.now()
    };
    const messageType = wantsWrite ? "stagingLoadout:equipResult" : "stagingLoadout:previewResult";

    if (wantsWrite &&
      STAGING_LOADOUT_WRITE_ITEM_IDS.has(itemId) &&
      !(operation === "unequip" && itemId.startsWith("ship:")) &&
      gates.writeEnabled === true &&
      gates.dryRun === false &&
      gates.verified === true &&
      gates.allowlisted === true &&
      gates.trustedSaveAvailable === true &&
      gates.itemAllowed === true &&
      player?.multiplayerMode === "staging") {
      const writeResult = await applyStagingLoadoutEquipWrite({
        playerId: identity.trustedPlayerId || identity.playerId,
        itemId,
        operation,
        inventorySource,
        inventoryItemId,
        quality,
        level,
        slotIndex,
        trustedState
      });
      client.send(messageType, {
        ...base,
        ...writeResult,
        gates,
        receivedAt: Date.now()
      });
      return;
    }

    let reason = !STAGING_LOADOUT_WRITE_ITEM_IDS.has(itemId)
      ? "unknown_loadout_item"
      : operation === "unequip" && itemId.startsWith("ship:")
        ? "unknown_loadout_item"
      : wantsWrite && player?.multiplayerMode !== "staging" && gates.writeEnabled && !gates.dryRun
        ? "staging_mode_required_for_loadout_write"
        : !gates.writeEnabled
          ? "staging_loadout_writes_disabled"
          : gates.dryRun
            ? "staging_loadout_dry_run_enabled"
            : !gates.verified
              ? "verified_identity_required"
              : !gates.allowlisted
                ? envGate.scopeInvalid
                  ? "staging_loadout_write_scope_invalid"
                  : envGate.scope === "disabled"
                    ? "staging_loadout_write_scope_disabled"
                    : envGate.scope === "allowlist" && !envGate.allowlistPresent
                      ? "staging_loadout_write_allowlist_missing"
                      : "player_not_in_staging_loadout_write_allowlist"
                : !gates.itemAllowed
                  ? "loadout_item_not_allowed"
                  : "trusted_save_required";

    let plan = null;
    if (trustedState?.available && trustedState?.rawSaveData) {
      plan = operation === "unequip"
        ? buildStagingLoadoutUnequipPlan(trustedState.rawSaveData, loadoutOptions)
        : buildStagingLoadoutEquipPlan(trustedState.rawSaveData, loadoutOptions);
      reason = plan.ok ? reason : plan.blockReason || reason;
    }

    client.send(messageType, {
      ...base,
      ...(plan || {}),
      ok: plan?.ok === true && reason === "staging_loadout_dry_run_enabled",
      mode: reason === "staging_loadout_dry_run_enabled" ? "dry_run" : "blocked",
      applied: false,
      dryRun: true,
      blockReason: plan?.blockReason || reason,
      reason,
      userReason: plan?.userReason || (reason === "staging_loadout_dry_run_enabled"
        ? `Would ${operation} ${base.name || "staging item"}. Dry run only - loadout not changed.`
        : `Blocked: ${reason}.`),
      gates,
      writes: base.writes,
      loadoutWritten: false,
      attachmentWritten: false,
      saveWritten: false,
      receivedAt: Date.now()
    });
  }

  respawnStagingBot(bot, index = 0, now = Date.now()) {
    const botTypePayload = this.getBotTypePayload(bot);
    const respawnNode = this.getNextBotNode(bot.currentNode, index + this.botStep + 1);
    const nodePosition = BOT_NODE_POSITIONS.get(respawnNode) || STAGING_BOT_NODES[index % STAGING_BOT_NODES.length] || STAGING_BOT_NODES[0];
    bot.currentNode = nodePosition.node;
    const position = this.allocateOpenSpacePosition(bot.currentNode, { kind: "bot", id: bot.id });
    bot.x = position.x;
    bot.y = position.y;
    bot.shield = Number(bot.shieldMax || 0);
    bot.hull = Number(bot.hullMax || 1);
    bot.disabled = false;
    bot.disabledUntil = 0;
    bot.lastUpdatedAt = now;
    bot.nextMoveAt = now + BOT_NODE_MOVE_MS + index * 1250;
    this.clearBotContributions(bot.id);
    this.rewardPreviews.delete(bot.id);

    this.broadcast("bot:respawned", {
      ok: true,
      botId: bot.id,
      ...botTypePayload,
      currentNode: bot.currentNode,
      shield: bot.shield,
      hull: bot.hull,
      contributionCleared: true,
      contributors: [],
      rewardsGranted: false,
      receivedAt: now
    });

    this.reconcilePlayerSelections();
  }

  getPvpTargetPlayer(targetPlayerId = "") {
    const targetId = getStringValue(targetPlayerId);
    if (!targetId) return null;
    const directTarget = this.state.players.get(targetId);
    if (directTarget) return directTarget;
    for (const player of this.state.players.values()) {
      if (player?.sessionId === targetId || player?.id === targetId || player?.trustedPlayerId === targetId || player?.playerId === targetId) {
        return player;
      }
    }
    return null;
  }

  applyStagingPvpDamage(targetPlayer, damage = calculatePrototypePvpDamage()) {
    ensurePlayerPvpState(targetPlayer);
    const requestedDamage = clampNumber(Math.round(Number(damage || calculatePrototypePvpDamage())), 1, 1000);
    const result = applyLayeredPvpDamage(targetPlayer, requestedDamage);
    targetPlayer.lastPvpHitAt = Date.now();
    targetPlayer.lastPvpShieldRegenAt = 0;
    return result;
  }

  recoverDestroyedPvpPlayer(targetPlayer, attacker = null, damageResult = {}, now = Date.now()) {
    if (!targetPlayer) return null;

    const previousNode = targetPlayer.currentNode || "";
    const previousPresenceStatus = targetPlayer.presenceStatus || "space";
    const shieldBeforeRepair = Number(targetPlayer.pvpShield || 0);
    const armorBeforeRepair = Number(targetPlayer.pvpArmor || 0);
    const hullBeforeRepair = Number(targetPlayer.pvpHull || 0);

    targetPlayer.currentNode = "Asteron Prime";
    targetPlayer.presenceStatus = "docked";
    targetPlayer.x = 50;
    targetPlayer.y = 50;
    targetPlayer.selectedTargetBotId = "";
    targetPlayer.lastCombatIntentReason = "pvp_destroyed_recovered";
    targetPlayer.lastCombatNodeValidationReason = "";
    targetPlayer.nextPvpFireAt = 0;

    targetPlayer.pvpShield = Number(targetPlayer.pvpShieldMax || STAGING_PVP_SHIELD_MAX);
    targetPlayer.pvpArmor = Number(targetPlayer.pvpArmorMax || 0);
    targetPlayer.pvpHull = Number(targetPlayer.pvpHullMax || STAGING_PVP_HULL_MAX);
    targetPlayer.lastPvpHitAt = 0;
    targetPlayer.lastPvpShieldRegenAt = now;
    targetPlayer.lastSeenAt = now;

    const payload = {
      ok: true,
      reason: "pvp_player_destroyed",
      targetPlayerId: targetPlayer.sessionId,
      targetSessionId: targetPlayer.sessionId,
      targetDisplayName: getSafeIdentityValue(targetPlayer.displayName, "Pilot") || "Pilot",
      attackerSessionId: attacker?.sessionId || "",
      attackerDisplayName: getSafeIdentityValue(attacker?.displayName, "Pilot") || "Pilot",
      previousNode,
      currentNode: targetPlayer.currentNode,
      targetNode: targetPlayer.currentNode,
      previousPresenceStatus,
      presenceStatus: targetPlayer.presenceStatus,
      shieldBefore: damageResult.shieldBefore,
      shieldAtDestruction: shieldBeforeRepair,
      shield: targetPlayer.pvpShield,
      shieldMax: targetPlayer.pvpShieldMax,
      armorBefore: damageResult.armorBefore,
      armorAtDestruction: armorBeforeRepair,
      armor: targetPlayer.pvpArmor,
      armorMax: targetPlayer.pvpArmorMax,
      hullBefore: damageResult.hullBefore,
      hullAtDestruction: hullBeforeRepair,
      hull: targetPlayer.pvpHull,
      hullMax: targetPlayer.pvpHullMax,
      defeated: true,
      deathApplied: true,
      restoredToFull: true,
      targetCleared: true,
      cargoLost: false,
      creditsLost: false,
      itemsLost: false,
      xpAwarded: false,
      bountyProgressChanged: false,
      rewardsGranted: false,
      serverAuthoritative: true,
      receivedAt: now
    };

    this.broadcast("playerMoved", this.buildPresenceEvent("moved", targetPlayer, {
      previousNode,
      currentNode: targetPlayer.currentNode,
      previousPresenceStatus,
      presenceStatus: targetPlayer.presenceStatus,
      reason: "pvp_destroyed_return"
    }));
    this.broadcast("pvp:destroyed", payload);
    return payload;
  }

  resolvePvpCombatIntent(client, message = {}, messageType = "combat:intent") {
    const attacker = this.touchPlayer(client.sessionId);
    const now = Date.now();
    const targetPlayerId = getStringValue(message.targetPlayerId || message.targetSessionId || message.playerTargetId);
    const targetPlayer = this.getPvpTargetPlayer(targetPlayerId);
    const pvpEligibility = getPvpEligibilityPreview(attacker, targetPlayer, message.currentNode);
    const pvpDiagnostics = getPvpCombatIntentDiagnostics({
      attacker,
      target: targetPlayer,
      message,
      targetPlayerId,
      pvpEligibility,
      now
    });

    if (!pvpEligibility.allowed) {
      if (attacker) {
        attacker.lastCombatIntentReason = pvpEligibility.reason || "pvp_intent_rejected";
        attacker.lastCombatNodeValidationReason = ["not_same_node", "intent_node_mismatch", "protected_zone"].includes(pvpEligibility.reason)
          ? pvpEligibility.reason
          : "";
      }
      this.sendCombatRejected(client, "pvp_intent_rejected", message, messageType, pvpEligibility.reason || "pvp_intent_rejected", {
        ...pvpDiagnostics
      });
      return;
    }

    if (Number(attacker.nextPvpFireAt || 0) > now) {
      this.sendCombatRejected(client, "pvp_fire_cooldown", message, messageType, "pvp_fire_cooldown", {
        ...pvpDiagnostics,
        cooldownRemainingMs: Math.max(0, Math.ceil(Number(attacker.nextPvpFireAt || 0) - now))
      });
      return;
    }

    ensurePlayerPvpState(attacker);
    ensurePlayerPvpState(targetPlayer);
    const resolvedWeapon = resolveStagingWeapon(message, attacker);
    const pvpCooldownMs = resolvedWeapon.cooldownMs;
    const serverDamageUsed = calculatePrototypePvpDamage(attacker, targetPlayer);
    const result = this.applyStagingPvpDamage(targetPlayer, serverDamageUsed);
    const targetDefeated = result.defeated === true || Number(result.hull || 0) <= 0;
    attacker.lastFireAt = now;
    attacker.nextPvpFireAt = now + pvpCooldownMs;
    attacker.lastCombatIntentReason = targetDefeated ? "pvp_target_destroyed" : "pvp_damage_applied";
    attacker.lastWeaponSourceReason = resolvedWeapon.weaponSourceReason || resolvedWeapon.damageSource || "";
    attacker.activeShipWeaponCount = Number(resolvedWeapon.activeShipWeaponCount || 0);
    attacker.validCombatWeaponCount = Number(resolvedWeapon.validCombatWeaponCount || 0);
    attacker.rejectedWeaponCount = Number(resolvedWeapon.rejectedWeaponCount || 0);
    attacker.firstRejectedWeaponReason = resolvedWeapon.firstRejectedWeaponReason || "";
    attacker.lastCombatNodeValidationReason = "pvp_node_valid";

    const hitPayload = {
      ok: true,
      reason: "pvp_damage_applied",
      messageType,
      pvpIntent: true,
      targetType: "remotePlayer",
      attackerSessionId: attacker.sessionId,
      attackerDisplayName: getSafeIdentityValue(attacker.displayName, "Pilot") || "Pilot",
      targetPlayerId: targetPlayer.sessionId || targetPlayerId,
      targetSessionId: targetPlayer.sessionId || targetPlayerId,
      targetDisplayName: getSafeIdentityValue(targetPlayer.displayName, "Pilot") || "Pilot",
      currentNode: attacker.currentNode,
      targetNode: targetPlayer.currentNode,
      weaponId: getSafeIdentityValue(message.weaponId),
      weaponKey: getSafeIdentityValue(message.weaponKey),
      weaponName: getStringValue(message.weaponName || message.weaponLabel).slice(0, 80),
      weaponFamily: getSafeIdentityValue(message.weaponFamily),
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
      clientDamageIgnored: resolvedWeapon.clientDamageIgnored === true,
      weaponSourceReason: resolvedWeapon.weaponSourceReason || resolvedWeapon.damageSource || "",
      activeShipWeaponCount: resolvedWeapon.activeShipWeaponCount || 0,
      validCombatWeaponCount: resolvedWeapon.validCombatWeaponCount || 0,
      rejectedWeaponCount: resolvedWeapon.rejectedWeaponCount || 0,
      firstRejectedWeaponReason: resolvedWeapon.firstRejectedWeaponReason || "",
      damage: result.damage,
      requestedDamage: result.requestedDamage,
      serverDamageUsed,
      pvpDamageApplied: true,
      playerDamageApplied: true,
      mutatedPlayerState: true,
      shieldDamage: result.shieldDamage,
      armorDamage: result.armorDamage,
      hullDamage: result.hullDamage,
      shieldBefore: result.shieldBefore,
      shield: result.shield,
      shieldMax: result.shieldMax,
      armorBefore: result.armorBefore,
      armor: result.armor,
      armorMax: result.armorMax,
      hullBefore: result.hullBefore,
      hull: result.hull,
      hullMax: result.hullMax,
      defeated: targetDefeated,
      deathApplied: targetDefeated,
      cargoLost: false,
      xpAwarded: false,
      bountyProgressChanged: false,
      rewardsGranted: false,
      serverAuthoritative: true,
      pvpRulePreview: pvpEligibility.reason,
      pvpEligibility,
      cooldownMs: pvpCooldownMs,
      nextPvpFireAt: attacker.nextPvpFireAt,
      receivedAt: Date.now()
    };

    client.send("combat:resolved", hitPayload);
    this.broadcast("pvp:hit", hitPayload);
    if (targetDefeated) {
      this.recoverDestroyedPvpPlayer(targetPlayer, attacker, result, hitPayload.receivedAt);
    }
  }

  async resolveCombatIntent(client, message = {}, messageType = "combat:intent") {
    const player = this.touchPlayer(client.sessionId);
    const now = Date.now();
    const targetPlayerId = getStringValue(message.targetPlayerId || message.targetSessionId || message.playerTargetId);
    if (targetPlayerId || getStringValue(message.targetType) === "remotePlayer") {
      this.resolvePvpCombatIntent(client, message, messageType);
      return;
    }
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

    if (!validationReason && player.selectedTargetBotId && player.selectedTargetBotId !== targetBotId) {
      validationReason = "combat target does not match selected staging bot";
    }

    if (!validationReason && clientCurrentNode && targetBot && clientCurrentNode !== player.currentNode && clientCurrentNode === targetBot.currentNode) {
      player.currentNode = clientCurrentNode;
      player.lastCombatNodeValidationReason = "player_presence_resynced_to_combat_bot_node";
    }

    if (!validationReason && Number(player.nextFireAt || 0) > now) {
      player.lastCombatIntentReason = "fire cooldown active";
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
      if (player) {
        player.lastCombatIntentReason = validationReason;
        player.lastCombatNodeValidationReason = validationReason.includes("node") ? validationReason : "";
      }
      this.sendCombatRejected(client, "combat_intent_rejected", message, messageType, validationReason);
      return;
    }

    if (!player.selectedTargetBotId) {
      player.selectedTargetBotId = targetBotId;
      player.lastLockOnClearReason = "";
      const nodeDebug = getNodeDebugPayload({ message, player, targetBot });
      client.send("target:selected", {
        ok: true,
        reason: "implicit_combat_lock",
        lockOnClearReason: "",
        combatNodeValidationReason: "combat_node_valid",
        ...nodeDebug,
        messageType,
        sessionId: client.sessionId,
        targetBotId,
        currentNode: player.currentNode,
        receivedAt: Date.now()
      });
    }

    const resolvedWeapon = resolveStagingWeapon(message, player);
    const stagingDamage = resolvedWeapon.damage;
    const stagingCooldownMs = resolvedWeapon.cooldownMs;
    const result = this.applyStagingTestDamage(targetBot, stagingDamage);
    const botTypePayload = this.getBotTypePayload(targetBot);
    player.lastFireAt = now;
    player.nextFireAt = now + stagingCooldownMs;
    player.lastCombatIntentReason = "staging_damage_applied";
    player.lastWeaponSourceReason = resolvedWeapon.weaponSourceReason || resolvedWeapon.damageSource || "";
    player.activeShipWeaponCount = Number(resolvedWeapon.activeShipWeaponCount || 0);
    player.validCombatWeaponCount = Number(resolvedWeapon.validCombatWeaponCount || 0);
    player.rejectedWeaponCount = Number(resolvedWeapon.rejectedWeaponCount || 0);
    player.firstRejectedWeaponReason = resolvedWeapon.firstRejectedWeaponReason || "";
    player.lastCombatNodeValidationReason = "combat_node_valid";

    const weaponName = resolvedWeapon.weaponName;
    const weaponFamily = resolvedWeapon.weaponFamily;
    const resolvedAt = Date.now();
    this.recordBotContribution(targetBot.id, client.sessionId, result.damage, resolvedAt);

    client.send("combat:resolved", {
      ok: true,
      reason: "staging_damage_applied",
      messageType,
      sessionId: client.sessionId,
      targetBotId,
      ...botTypePayload,
      targetNode: targetBot.currentNode,
      currentNode: player.currentNode,
      weaponId: resolvedWeapon.weaponKey,
      weaponKey: resolvedWeapon.weaponKey,
      weaponName,
      weaponFamily,
      volleyWeaponCount: resolvedWeapon.volleyWeaponCount,
      volleyWeaponKeys: resolvedWeapon.volleyWeaponKeys,
      weaponQuality: getStringValue(message.quality),
      weaponLevel: getNumberValue(message.level, 0),
      damage: result.damage,
      requestedDamage: resolvedWeapon.requestedDamage,
      stagingDamage,
      serverDamageUsed: stagingDamage,
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
      clientDamageIgnored: resolvedWeapon.clientDamageIgnored === true,
      serverAuthoritative: resolvedWeapon.serverAuthoritative === true,
      pulseLaserDetected: resolvedWeapon.pulseLaserDetected,
      weaponSourceReason: resolvedWeapon.weaponSourceReason || resolvedWeapon.damageSource || "",
      combatIntentReason: "staging_damage_applied",
      combatNodeValidationReason: "combat_node_valid",
      ...getNodeDebugPayload({ message, player, targetBot }),
      activeShipWeaponCount: resolvedWeapon.activeShipWeaponCount || 0,
      validCombatWeaponCount: resolvedWeapon.validCombatWeaponCount || 0,
      rejectedWeaponCount: resolvedWeapon.rejectedWeaponCount || 0,
      firstRejectedWeaponReason: resolvedWeapon.firstRejectedWeaponReason || "",
      shieldDamage: result.shieldDamage,
      hullDamage: result.hullDamage,
      shield: result.shield,
      hull: result.hull,
      disabled: result.disabled,
      cooldownMs: stagingCooldownMs,
      nextFireAt: player.nextFireAt,
      rewardsGranted: false,
      receivedAt: resolvedAt
    });

    // Visual-only staging combat event. Clients may render a synced flash/beam
    // from this payload, but it is not a real projectile simulation and never
    // grants rewards, progression, saves, or PvP/player damage.
    this.broadcast("staging:shot", {
      ok: true,
      attackerSessionId: client.sessionId,
      attackerDisplayName: player.displayName || "Pilot",
      targetBotId,
      ...botTypePayload,
      currentNode: player.currentNode,
      damage: result.damage,
      weaponKey: resolvedWeapon.weaponKey,
      weaponName,
      weaponFamily,
      weaponType: resolvedWeapon.weaponType,
      volleyWeaponCount: resolvedWeapon.volleyWeaponCount,
      volleyWeaponKeys: resolvedWeapon.volleyWeaponKeys,
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
      clientDamageIgnored: resolvedWeapon.clientDamageIgnored === true,
      serverAuthoritative: resolvedWeapon.serverAuthoritative === true,
      pulseLaserDetected: resolvedWeapon.pulseLaserDetected,
      weaponSourceReason: resolvedWeapon.weaponSourceReason || resolvedWeapon.damageSource || "",
      shield: result.shield,
      hull: result.hull,
      disabled: result.disabled,
      rewardsGranted: false,
      timestamp: resolvedAt,
      receivedAt: resolvedAt
    });

    if (!result.disabled) {
      this.maybeSendStagingBotReturnFire(client, player, targetBot, resolvedAt);
    }

    if (result.disabled) {
      this.clearStagingReturnFireForBot(targetBot.id);
      const contributionSummary = this.getContributionSummary(targetBot.id);
      const bountyProgressResult = this.updateStagingBountyProgressForDisabledBot(targetBot, contributionSummary, client.sessionId);
      const destructionInstanceId = this.getStagingBountyDestructionKey(targetBot);
      const rewardPreview = this.buildRewardPreviewPayload(targetBot, client.sessionId, contributionSummary, Date.now(), destructionInstanceId);
      this.rewardPreviews.set(targetBot.id, rewardPreview);
      await this.applyStagingBotKillXpForPreview(rewardPreview);

      this.broadcast("bot:disabled", {
        ok: true,
        botId: targetBot.id,
        ...botTypePayload,
        currentNode: targetBot.currentNode,
        shield: targetBot.shield,
        hull: targetBot.hull,
        disabledUntil: targetBot.disabledUntil,
        destructionInstanceId,
        rewardPreviewId: rewardPreview.rewardPreviewId,
        botXpSourceEventId: rewardPreview.botXpSourceEventId,
        botName: rewardPreview.botName,
        disabledBySessionId: client.sessionId,
        finalHitBy: client.sessionId,
        topContributorSessionId: contributionSummary.topContributorSessionId,
        contributors: contributionSummary.contributors,
        previewXp: rewardPreview.previewXp,
        previewCredits: rewardPreview.previewCredits,
        bountyProgress: bountyProgressResult?.changed === true
          ? getPublicStagingBountyState(bountyProgressResult.state)
          : null,
        bountyProgressChanged: bountyProgressResult?.changed === true,
        bountyProgressReason: getStringValue(bountyProgressResult?.reason),
        xpResultEventType: "stagingXp:botKillResult",
        xpAwardedByServer: true,
        xpReceiptPending: true,
        rewardsGranted: false,
        rewardReceipt: true,
        receivedAt: Date.now()
      });

      // Preview-only multiplayer reward design event. This is intentionally
      // detached from XP, credits, inventory, bounties, saves, and Supabase.
      this.broadcast("staging:reward_preview", rewardPreview);
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
    const previousNode = player.currentNode || "";
    const previousPresenceStatus = player.presenceStatus || "space";

    const displayName = getStringValue(message.displayName);
    if (displayName) player.displayName = displayName;

    if (typeof message.guildId === "string") {
      player.guildId = getSafeIdentityValue(message.guildId);
    }

    // Presence updates may refresh display-only identity labels, but they do
    // not upgrade trusted identity. Only onJoin token verification can do that.

    if (typeof message.currentShipId === "string") {
      player.currentShipId = message.currentShipId.trim();
    }

    if (typeof message.shipName === "string" || typeof message.ship === "string") {
      player.shipName = getShipName(message);
    }

    if (typeof message.shipImage === "string" || typeof message.shipImageSrc === "string" || typeof message.shipImagePath === "string") {
      const requestedShipImage = getShipImageValue(message);
      const safeShipImage = getSafeShipImagePath(requestedShipImage);
      if (requestedShipImage && !safeShipImage) {
        this.sendWarning(client, "shipImage path is unsafe", messageType);
      } else {
        player.shipImage = safeShipImage;
      }
    }

    if (typeof message.shipClass === "string" || typeof message.shipType === "string" || typeof message.shipRole === "string") {
      player.shipClass = getSafeShipClass(message);
    }

    updatePlayerPvpCapacityFromPresence(player, message);

    const weaponKey = getSafeWeaponKey(message.equippedWeaponKey || message.weaponKey);
    if (weaponKey) player.equippedWeaponKey = weaponKey;

    const weaponKeys = Array.isArray(message.equippedWeaponKeys)
      ? message.equippedWeaponKeys.map((entry) => getSafeWeaponKey(entry)).filter(Boolean)
      : String(message.equippedWeaponKeys || "").split(",").map((entry) => getSafeWeaponKey(entry)).filter(Boolean);
    if (weaponKeys.length) player.equippedWeaponKeys = weaponKeys.slice(0, 20).join(",");

    const currentNode = getStringValue(message.currentNode);
    if (currentNode) player.currentNode = currentNode;
    if (typeof message.presenceStatus === "string" || typeof message.status === "string") {
      player.presenceStatus = getSafePresenceStatus(message.presenceStatus || message.status);
    }
    const presenceStatusChanged = previousPresenceStatus !== (player.presenceStatus || "space");
    const nodeChanged = normalizePresenceNode(previousNode) !== normalizePresenceNode(player.currentNode);
    const enteredSpace = previousPresenceStatus === "docked" && player.presenceStatus !== "docked";
    if (player.presenceStatus !== "docked" && (nodeChanged || enteredSpace || !Number.isFinite(Number(player.x)) || !Number.isFinite(Number(player.y)))) {
      const position = this.allocateOpenSpacePosition(player.currentNode, {
        kind: "player",
        id: client.sessionId
      });
      player.x = position.x;
      player.y = position.y;
    }
    if (currentNode && (nodeChanged || presenceStatusChanged)) {
      this.broadcast("playerMoved", this.buildPresenceEvent("moved", player, {
        previousNode,
        currentNode,
        previousPresenceStatus,
        presenceStatus: player.presenceStatus || "space"
      }));
    }
    this.reconcilePlayerSelection(player);
  }
}
