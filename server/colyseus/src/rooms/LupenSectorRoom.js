import { Room } from "colyseus";
import { MapSchema, Schema, type } from "@colyseus/schema";
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
  STAGING_BOUNTY,
  STAGING_BOUNTY_ID,
  buildStagingBountySourceEventId,
  createStagingBountyState,
  getPublicStagingBountyState,
  getStagingBounties,
  recordStagingBountyBotDestruction
} from "../config/stagingBountyConfig.js";
import {
  buildStagingLootPreview
} from "../config/stagingLootConfig.js";
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
const PVP_SAFE_NODE_IDS = new Set(["Asteron Prime", "Virella", "Nyxara"]);
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
const STAGING_DAMAGE_MIN = 1;
const STAGING_DAMAGE_MAX = 50;
const STAGING_FIRE_COOLDOWN_MS = 900;
const STAGING_FIRE_COOLDOWN_MIN_MS = 450;
const STAGING_FIRE_COOLDOWN_MAX_MS = 2500;
const STAGING_BOT_RETURN_FIRE_DAMAGE = 4;
const STAGING_BOT_RETURN_FIRE_INTERVAL_MS = 2600;
const STAGING_BOT_RETURN_FIRE_VARIANCE_MS = 650;
const STAGING_WEAPON_STATS = Object.freeze({
  heavyLance: Object.freeze({
    key: "heavyLance",
    name: "Heavy Lance",
    family: "heavy",
    type: "heavy",
    damage: 16,
    cooldownMs: 2222
  }),
  ionBlaster: Object.freeze({
    key: "ionBlaster",
    name: "Ion Blaster",
    family: "ion",
    type: "ion",
    damage: 10,
    cooldownMs: 909
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
    damage: 10,
    cooldownMs: 1000
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

const DUMMY_BOT_DEFINITIONS = [
  { id: "dev-bot-erebus-1", type: "Erebus Drone", name: "Erebus Drone", startNode: "Upper Arc West", level: 1, shield: 22, hull: 48 },
  { id: "dev-bot-erebus-2", type: "Erebus Drone", name: "Erebus Scout", startNode: "Upper Lane East B", level: 1, shield: 18, hull: 44 },
  { id: "dev-bot-erebus-3", type: "Erebus Drone", name: "Erebus Watcher", startNode: "Lower Lane West B", level: 1, shield: 28, hull: 56 },
  { id: "dev-bot-erebus-4", type: "Erebus Drone", name: "Erebus Surveyor", startNode: "Lower Arc East", level: 1, shield: 24, hull: 52 },
  { id: "dev-bot-erebus-5", type: "Erebus Drone", name: "Erebus Scout", startNode: "Upper Gate Core", level: 1, shield: 20, hull: 48 },
  { id: "dev-bot-erebus-6", type: "Erebus Drone", name: "Erebus Watcher", startNode: "Lower Gate Core", level: 1, shield: 28, hull: 56 },
  { id: "dev-bot-erebus-7", type: "Erebus Drone", name: "Erebus Drone", startNode: "Upper Mid West B", level: 1, shield: 22, hull: 48 },
  { id: "dev-bot-erebus-8", type: "Erebus Drone", name: "Erebus Scout", startNode: "Upper Mid East B", level: 1, shield: 18, hull: 44 },
  { id: "dev-bot-erebus-9", type: "Erebus Drone", name: "Erebus Surveyor", startNode: "Lower Mid West B", level: 1, shield: 24, hull: 52 },
  { id: "dev-bot-erebus-10", type: "Erebus Drone", name: "Erebus Watcher", startNode: "Lower Mid East B", level: 1, shield: 28, hull: 56 }
];

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
    return gates.scope === "allowlist"
      ? "player_not_in_staging_trade_write_allowlist"
      : "staging_trade_write_scope_disabled";
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
    allowlisted: gates.allowlisted === true,
    trustedSaveAvailable: gates.trustedSaveAvailable === true,
    currentNode: player?.currentNode || "",
    sellNode: result.sellNode || "",
    sellValidationReason: result.sellValidationReason || "",
    trustedCargo: result.trustedCargo || null,
    costBasisFound: result.costBasisFound === true
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

function getPvpEligibilityPreview(attacker = null, target = null, currentNode = "") {
  const node = getStringValue(currentNode || attacker?.currentNode || target?.currentNode);
  const targetId = getStringValue(target?.sessionId || target?.id);
  const attackerId = getStringValue(attacker?.sessionId || attacker?.id);
  if (!attacker) return { allowed: false, reason: "attacker_not_found", pvpEnabled: false };
  if (!target) return { allowed: false, reason: "target_not_found", pvpEnabled: false };
  if (attackerId && targetId && attackerId === targetId) return { allowed: false, reason: "self_target", pvpEnabled: false };
  if (getSafePresenceStatus(target?.presenceStatus) === "docked") return { allowed: false, reason: "target_docked", pvpEnabled: false };
  if (normalizePresenceNode(attacker?.currentNode) !== normalizePresenceNode(target?.currentNode)) return { allowed: false, reason: "not_same_node", pvpEnabled: false };
  if (PVP_SAFE_NODE_IDS.has(node)) return { allowed: false, reason: "safe_area", pvpEnabled: false };
  const attackerGuild = getSafeIdentityValue(attacker?.guildId);
  const targetGuild = getSafeIdentityValue(target?.guildId);
  if (attackerGuild && targetGuild && attackerGuild === targetGuild) return { allowed: false, reason: "guild_ally", pvpEnabled: false };
  return { allowed: false, reason: "pvp_disabled", pvpEnabled: false };
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
  const xpWriteAllowed = verified &&
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
    ? "xp_only"
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
      ? "xp_only_staging_claim_applied"
      : mode === "blocked"
        ? debugReason
        : mode === "dry_run"
          ? "staging_xp_claim_dry_run"
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
      xpWriteAllowed
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

function getFirstWeaponKeyFromList(value) {
  return getWeaponKeysFromValue(value)[0] || "";
}

function getWeaponSourceDebug(message = {}, player = null, selectedKey = "") {
  const payloadKeys = [
    getSafeWeaponKey(message.weaponKey),
    getSafeWeaponKey(message.equippedWeaponKey),
    ...getWeaponKeysFromValue(message.equippedWeaponKeys)
  ].filter(Boolean);
  const presenceKeys = [
    getSafeWeaponKey(player?.equippedWeaponKey),
    ...getWeaponKeysFromValue(player?.equippedWeaponKeys)
  ].filter(Boolean);
  const allKeys = [...payloadKeys, ...presenceKeys];
  const uniqueKeys = Array.from(new Set(allKeys));
  const validKeys = uniqueKeys.filter((key) => !!STAGING_WEAPON_STATS[key]);
  const rejectedKeys = uniqueKeys.filter((key) => !STAGING_WEAPON_STATS[key]);
  const fallbackWeaponId = getSafeWeaponKey(message.weaponId);
  const fallbackRejected = fallbackWeaponId && fallbackWeaponId !== selectedKey && !STAGING_WEAPON_STATS[fallbackWeaponId];
  const firstRejectedWeaponReason = rejectedKeys[0]
    ? `unknown_weapon:${rejectedKeys[0]}`
    : fallbackRejected
      ? `weaponId_not_catalog_weapon:${fallbackWeaponId}`
      : uniqueKeys.length
        ? ""
        : "no_equipped_weapon_keys";

  return {
    activeShipWeaponCount: uniqueKeys.length,
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

function getRequestedDamageFromPayload(message = {}) {
  const directDamage = Number(message.damage ?? message.weaponDamage);
  return Number.isFinite(directDamage) ? directDamage : 0;
}

function resolveStagingWeapon(message = {}, player = null) {
  const payloadKey = getSafeWeaponKey(message.weaponKey || message.equippedWeaponKey);
  const payloadListKey = getFirstWeaponKeyFromList(message.equippedWeaponKeys);
  const presenceKey = getSafeWeaponKey(player?.equippedWeaponKey);
  const presenceListKey = getFirstWeaponKeyFromList(player?.equippedWeaponKeys);
  const weaponIdKey = getSafeWeaponKey(message.weaponId);
  const weaponKey = payloadKey || payloadListKey || presenceKey || presenceListKey || weaponIdKey;
  const known = STAGING_WEAPON_STATS[weaponKey] || null;
  const requestedDamage = getRequestedDamageFromPayload(message);
  const payloadCount = getNumberValue(message.count, 0);
  const hasMultiWeaponLoadout = payloadCount > 1 || String(message.weaponName || "").includes(" + ");
  const debug = getWeaponSourceDebug(message, player, weaponKey);

  if (known) {
    const knownDamage = clampNumber(Math.round(known.damage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX);
    const aggregateDamage = hasMultiWeaponLoadout && requestedDamage > knownDamage
      ? clampNumber(Math.round(requestedDamage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX)
      : knownDamage;
    return {
      weaponKey: known.key,
      weaponName: known.name,
      weaponFamily: known.family,
      weaponType: known.type,
      damage: aggregateDamage,
      cooldownMs: clampNumber(Math.round(known.cooldownMs), STAGING_FIRE_COOLDOWN_MIN_MS, STAGING_FIRE_COOLDOWN_MAX_MS),
      damageSource: aggregateDamage === knownDamage ? "server_known_weapon" : "client_loadout_aggregate",
      fallbackDamageUsed: false,
      pulseLaserDetected: known.key === "pulseLaser",
      requestedDamage,
      ...debug,
      weaponSourceReason: aggregateDamage === knownDamage ? "server_known_weapon" : "client_loadout_aggregate"
    };
  }

  const clampedRequestedDamage = hasMultiWeaponLoadout && requestedDamage > 0
    ? clampNumber(Math.round(requestedDamage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX)
    : STAGING_TEST_DAMAGE;

  return {
    weaponKey,
    weaponName: getStringValue(message.weaponName, "Staging Fallback") || "Staging Fallback",
    weaponFamily: getStringValue(message.weaponFamily || message.weaponType || "staging-fallback"),
    weaponType: getStringValue(message.weaponType || message.weaponFamily || "staging-fallback"),
    damage: clampedRequestedDamage,
    cooldownMs: STAGING_FIRE_COOLDOWN_MS,
    damageSource: hasMultiWeaponLoadout && requestedDamage > 0 ? "client_loadout_aggregate" : (weaponKey ? "fallback_unknown_weapon" : "fallback_no_weapon"),
    fallbackDamageUsed: !(hasMultiWeaponLoadout && requestedDamage > 0),
    pulseLaserDetected: false,
    requestedDamage,
    ...debug,
    weaponSourceReason: hasMultiWeaponLoadout && requestedDamage > 0 ? "client_loadout_aggregate" : debug.weaponSourceReason
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
    if (replacementIdentityKey) {
      this.state.players.forEach((player, sessionId) => {
        if (sessionId === client.sessionId) return;
        if (getPresenceIdentityKey(player) !== replacementIdentityKey) return;
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
      nextFireAt: 0
    });

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
        x: patrolNode.x,
        y: patrolNode.y,
        level: Number(definition.level || 1),
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

      const nodePosition = BOT_NODE_POSITIONS.get(bot.currentNode) || STAGING_BOT_NODES[0];
      bot.x = clampNumber(nodePosition.x, 4, 96);
      bot.y = clampNumber(nodePosition.y, 4, 96);
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

  buildPresenceEvent(type, player, extra = {}) {
    return {
      type,
      sessionId: player?.sessionId || "",
      displayName: getSafeIdentityValue(player?.displayName, "Pilot") || "Pilot",
      currentNode: player?.currentNode || "",
      presenceStatus: player?.presenceStatus || "space",
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

  maybeSendStagingBotReturnFire(client, player, bot, now = Date.now()) {
    if (!client || !player || !bot) return null;
    if (bot.disabled || bot.currentNode !== player.currentNode) return null;
    if (player.selectedTargetBotId !== bot.id) return null;

    const cooldownKey = this.getStagingReturnFireKey(client.sessionId, bot.id);
    const nextAllowedAt = Number(this.stagingBotReturnFireCooldowns.get(cooldownKey) || 0);
    if (nextAllowedAt > now) return null;

    const rhythmSeed = String(bot.id || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const rhythmOffset = (rhythmSeed % (STAGING_BOT_RETURN_FIRE_VARIANCE_MS * 2 + 1)) - STAGING_BOT_RETURN_FIRE_VARIANCE_MS;
    const cooldownMs = Math.max(1600, STAGING_BOT_RETURN_FIRE_INTERVAL_MS + rhythmOffset);
    const nextReturnFireAt = now + cooldownMs;
    this.stagingBotReturnFireCooldowns.set(cooldownKey, nextReturnFireAt);

    const payload = {
      ok: true,
      reason: "staging_bot_return_fire",
      sessionId: client.sessionId,
      attackerBotId: bot.id,
      attackerName: bot.name || bot.type || "Erebus Bot",
      currentNode: player.currentNode,
      damage: STAGING_BOT_RETURN_FIRE_DAMAGE,
      botDamage: STAGING_BOT_RETURN_FIRE_DAMAGE,
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

    client.send("staging:return_fire", payload);
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
        botName: getStringValue(preview.botName, "Staging Bot"),
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
    const finalHitIdentity = this.getPlayerIdentitySnapshot(disabledBySessionId);
    const topContributorIdentity = this.getPlayerIdentitySnapshot(contributionSummary.topContributorSessionId);
    const eligibleSessionIds = (Array.isArray(contributionSummary?.contributors) ? contributionSummary.contributors : [])
      .map((contributor) => getStringValue(contributor?.sessionId))
      .filter(Boolean);
    if (disabledBySessionId) eligibleSessionIds.push(getStringValue(disabledBySessionId));
    const rewardPreviewId = `staging_bot_reward:${safeDestructionInstanceId}`;
    const botXpSourceEventId = `staging_bot_xp:${safeDestructionInstanceId}`;
    const lootPreview = buildStagingLootPreview({
      botId,
      rewardPreviewId,
      eligibleSessionIds
    });
    return {
      ok: true,
      rewardPreviewId,
      botXpSourceEventId,
      destructionInstanceId: safeDestructionInstanceId,
      botId,
      botName: bot?.name || bot?.type || "Staging Bot",
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
      previewXp: STAGING_REWARD_DRY_RUN_XP,
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
    if (bountyId !== STAGING_BOUNTY_ID) {
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
    if (existing?.claimed) {
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

    const nextState = createStagingBountyState(client.sessionId, Date.now());
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

    uniqueContributors.forEach((sessionId) => {
      const currentState = this.getStagingBountyState(sessionId);
      const result = recordStagingBountyBotDestruction(currentState, {
        botId: this.getStagingBountyDestructionKey(bot),
        contributorSessionIds: uniqueContributors,
        now: Date.now()
      });
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
  }

  buildStagingBountyRewardWritePlan(client, bountyState) {
    const identity = this.getPlayerIdentitySnapshot(client.sessionId);
    const trustedPlayerId = identity.trustedPlayerId || identity.playerId || identity.supabaseUserId || "";
    const eligible = identity.authStatus === "verified" && !!trustedPlayerId;
    const sourceEventId = buildStagingBountySourceEventId(bountyState, trustedPlayerId || client.sessionId);
    return {
      playerId: eligible ? trustedPlayerId : "",
      trustedPlayerId: eligible ? trustedPlayerId : "",
      authStatus: identity.authStatus || "guest",
      displayName: identity.displayName || "Pilot",
      botId: STAGING_BOUNTY.id,
      botName: STAGING_BOUNTY.title,
      node: this.state.players.get(client.sessionId)?.currentNode || "",
      finalHitBy: client.sessionId,
      topContributorSessionId: client.sessionId,
      contributorSessionId: client.sessionId,
      contributionPercent: 100,
      intendedXp: STAGING_BOUNTY.xpReward,
      intendedCredits: 0,
      intendedLoot: [],
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
    const publicState = getPublicStagingBountyState(bountyState);
    const blockedReason = !player
      ? "session_player_not_found"
      : bountyId !== STAGING_BOUNTY_ID
        ? "unknown_staging_bounty"
        : !bountyState?.accepted
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
      creditsWritten: false,
      lootWritten: false,
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
      player?.multiplayerMode === "staging";

    if (canAttemptWrite) {
      const writeResult = await applyStagingStorePurchaseWrite({
        playerId: identity.trustedPlayerId || identity.playerId,
        itemId,
        quantity: message?.quantity,
        trustedState
      });

      client.send("stagingStore:purchaseResult", {
        ...baseResult,
        ...writeResult,
        gates,
        validationMode: writeResult.validationMode || preview.validationMode,
        trustedStateAvailable: true,
        snapshotUsed: false,
        sessionId: client.sessionId,
        receivedAt: Date.now()
      });
      return;
    }

    const previewOnlyReason = !storeWriteQuantityValid
      ? "invalid_store_quantity"
      : item && !STAGING_STORE_WRITE_ITEM_IDS.has(item.itemId)
      ? "store_item_preview_only"
      : player?.multiplayerMode !== "staging" && gates.writeEnabled && !gates.dryRun
        ? "staging_mode_required_for_store_write"
        : !gates.writeEnabled
          ? "staging_store_writes_disabled"
          : gates.dryRun
            ? "staging_store_dry_run_enabled"
            : !gates.verified
              ? "verified_identity_required"
              : !gates.allowlisted
                ? envGate.scope === "allowlist" && !envGate.allowlistPresent
                  ? "staging_store_write_allowlist_missing"
                  : "player_not_in_staging_store_write_allowlist"
                : !gates.itemAllowed
                  ? "store_item_not_allowed"
                  : preview.blockReason || "store_write_unavailable";

    client.send("stagingStore:purchaseResult", {
      ...baseResult,
      ok: preview.ok === true && previewOnlyReason === "staging_store_dry_run_enabled",
      mode: previewOnlyReason === "staging_store_dry_run_enabled" ? "dry_run" : "blocked",
      applied: false,
      dryRun: true,
      blockReason: previewOnlyReason === "invalid_store_quantity" ? "invalid_store_quantity" : preview.blockReason || previewOnlyReason,
      reason: previewOnlyReason,
      userReason: item && !STAGING_STORE_WRITE_ITEM_IDS.has(item.itemId)
        ? "This item is preview-only in staging."
        : previewOnlyReason === "staging_store_dry_run_enabled"
          ? "Dry run only - no credits or Store ownership changed."
          : preview.userReason,
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
                ? envGate.scope === "allowlist" && !envGate.allowlistPresent
                  ? "staging_loadout_write_allowlist_missing"
                  : "player_not_in_staging_loadout_write_allowlist"
                : !gates.itemAllowed
                  ? "loadout_item_not_allowed"
                  : "trusted_save_required";

    let plan = null;
    if (trustedState?.available && trustedState?.rawSaveData) {
      plan = operation === "unequip"
        ? buildStagingLoadoutUnequipPlan(trustedState.rawSaveData, { itemId })
        : buildStagingLoadoutEquipPlan(trustedState.rawSaveData, { itemId });
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
    this.clearBotContributions(bot.id);
    this.rewardPreviews.delete(bot.id);

    this.broadcast("bot:respawned", {
      ok: true,
      botId: bot.id,
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

  async resolveCombatIntent(client, message = {}, messageType = "combat:intent") {
    const player = this.touchPlayer(client.sessionId);
    const now = Date.now();
    const targetPlayerId = getStringValue(message.targetPlayerId || message.targetSessionId || message.playerTargetId);
    if (targetPlayerId || getStringValue(message.targetType) === "remotePlayer") {
      const targetPlayer = targetPlayerId ? this.state.players.get(targetPlayerId) : null;
      const pvpEligibility = getPvpEligibilityPreview(player, targetPlayer, message.currentNode);
      const pvpDiagnostics = getPvpCombatIntentDiagnostics({
        attacker: player,
        target: targetPlayer,
        message,
        targetPlayerId,
        pvpEligibility,
        now
      });
      if (player) {
        player.lastCombatIntentReason = "pvp_unavailable_in_staging";
        player.lastCombatNodeValidationReason = "";
      }
      this.sendCombatRejected(client, "pvp_unavailable_in_staging", message, messageType, "pvp_unavailable_in_staging", {
        ...pvpDiagnostics
      });
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
      targetNode: targetBot.currentNode,
      currentNode: player.currentNode,
      weaponId: resolvedWeapon.weaponKey,
      weaponKey: resolvedWeapon.weaponKey,
      weaponName,
      weaponFamily,
      weaponQuality: getStringValue(message.quality),
      weaponLevel: getNumberValue(message.level, 0),
      damage: result.damage,
      requestedDamage: resolvedWeapon.requestedDamage,
      stagingDamage,
      serverDamageUsed: stagingDamage,
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
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
      targetBotId,
      currentNode: player.currentNode,
      damage: result.damage,
      weaponKey: resolvedWeapon.weaponKey,
      weaponName,
      weaponFamily,
      weaponType: resolvedWeapon.weaponType,
      damageSource: resolvedWeapon.damageSource,
      fallbackDamageUsed: resolvedWeapon.fallbackDamageUsed,
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
      this.updateStagingBountyProgressForDisabledBot(targetBot, contributionSummary, client.sessionId);
      const destructionInstanceId = this.getStagingBountyDestructionKey(targetBot);
      const rewardPreview = this.buildRewardPreviewPayload(targetBot, client.sessionId, contributionSummary, Date.now(), destructionInstanceId);
      this.rewardPreviews.set(targetBot.id, rewardPreview);
      await this.applyStagingBotKillXpForPreview(rewardPreview);

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

    const x = Number(message.x);
    const y = Number(message.y);
    if (Number.isFinite(x)) player.x = x;
    if (Number.isFinite(y)) player.y = y;

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
    if (currentNode && (normalizePresenceNode(previousNode) !== normalizePresenceNode(currentNode) || presenceStatusChanged)) {
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
