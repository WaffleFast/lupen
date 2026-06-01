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
  buildStagingTradePreview,
  buildStagingTradeWriteDryRun,
  getStagingTradeOfferById,
  getStagingTradeOffers
} from "../config/stagingTradeConfig.js";
import {
  buildStagingStorePurchasePreview,
  getStagingStoreItemById,
  getStagingStoreItems
} from "../config/stagingStoreConfig.js";
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
const STAGING_STORE_WRITE_ITEM_IDS = new Set(["attachment:cargoPod", "gun:pulseLaser"]);
const STAGING_LOADOUT_WRITE_ITEM_IDS = new Set(["attachment:cargoPod", "gun:pulseLaser"]);

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
const STAGING_WEAPON_STATS = Object.freeze({
  pulseLaser: Object.freeze({
    key: "pulseLaser",
    name: "Pulse Laser",
    family: "pulse",
    type: "pulse",
    damage: 10,
    cooldownMs: 1000
  })
});
const STAGING_BOT_DISABLED_RESET_MS = 6500;
const SUPABASE_VERIFY_TIMEOUT_MS = 4000;
const STAGING_REWARD_DRY_RUN_XP = 5;
const STAGING_REWARD_DRY_RUN_CREDITS = 0;

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
type("string")(LupenSectorPlayer.prototype, "authStatus");
type("string")(LupenSectorPlayer.prototype, "playerId");
type("string")(LupenSectorPlayer.prototype, "supabaseUserId");
type("string")(LupenSectorPlayer.prototype, "trustedPlayerId");
type("string")(LupenSectorPlayer.prototype, "displayName");
type("string")(LupenSectorPlayer.prototype, "currentShipId");
type("string")(LupenSectorPlayer.prototype, "shipName");
type("string")(LupenSectorPlayer.prototype, "shipImage");
type("string")(LupenSectorPlayer.prototype, "shipClass");
type("string")(LupenSectorPlayer.prototype, "equippedWeaponKey");
type("string")(LupenSectorPlayer.prototype, "equippedWeaponKeys");
type("string")(LupenSectorPlayer.prototype, "multiplayerMode");
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

function getShipImageValue(message = {}) {
  return message.shipImage || message.shipImageSrc || message.shipImagePath || "";
}

function getSafeShipImagePath(value = "") {
  const path = getStringValue(value).replace(/\\/g, "/").slice(0, 160);
  if (!path) return "";
  if (!/^assets\/(?:ships|player-ships|hub\/ships)\/[a-z0-9-]+\.png$/i.test(path)) return "";
  if (path.includes("..") || path.includes("//")) return "";
  return path;
}

function getSafeShipClass(message = {}) {
  return getSafeIdentityValue(message.shipClass || message.shipType || message.shipRole, "").slice(0, 80);
}

function getSafeIdentityValue(value, fallback = "") {
  return getStringValue(value, fallback).slice(0, 120);
}

function getAuthStatus(options = {}) {
  const requestedStatus = getSafeIdentityValue(options.authStatus, "guest").toLowerCase();

  if (requestedStatus === "verified") return "verified";
  if (requestedStatus === "unverified") return "unverified";
  return "guest";
}

function getSupabaseVerifyConfig(env = process.env) {
  return {
    url: getSafeIdentityValue(env.SUPABASE_URL),
    serviceRoleKey: getSafeIdentityValue(env.SUPABASE_SERVICE_ROLE_KEY)
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
  if (!config.url || !config.serviceRoleKey || typeof fetchImpl !== "function") {
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
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        authStatus: "unverified",
        trustedPlayerId: "",
        supabaseUserId: "",
        displayName: "",
        reason: "supabase_token_invalid"
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
    intendedLoot: Array.isArray(preview.previewLoot) ? preview.previewLoot.map((item) => getSafeIdentityValue(item)).filter(Boolean) : [],
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

function buildRewardClaimStatus({
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

  const shipImageValue = getShipImageValue(message);
  if (shipImageValue && typeof shipImageValue === "string" && shipImageValue.trim() && !getSafeShipImagePath(shipImageValue)) {
    return "shipImage path is unsafe";
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

function getFirstWeaponKeyFromList(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const key = getSafeWeaponKey(entry);
      if (key) return key;
    }
    return "";
  }

  return String(value || "")
    .split(",")
    .map((entry) => getSafeWeaponKey(entry))
    .find(Boolean) || "";
}

function getRequestedDamageFromPayload(message = {}) {
  const directDamage = Number(message.damage ?? message.weaponDamage);
  return Number.isFinite(directDamage) ? directDamage : 0;
}

function resolveStagingWeapon(message = {}, player = null) {
  const payloadKey = getSafeWeaponKey(message.weaponKey || message.weaponId || message.equippedWeaponKey);
  const payloadListKey = getFirstWeaponKeyFromList(message.equippedWeaponKeys);
  const presenceKey = getSafeWeaponKey(player?.equippedWeaponKey);
  const presenceListKey = getFirstWeaponKeyFromList(player?.equippedWeaponKeys);
  const weaponKey = payloadKey || payloadListKey || presenceKey || presenceListKey;
  const known = STAGING_WEAPON_STATS[weaponKey] || null;

  if (known) {
    return {
      weaponKey: known.key,
      weaponName: known.name,
      weaponFamily: known.family,
      weaponType: known.type,
      damage: clampNumber(Math.round(known.damage), STAGING_DAMAGE_MIN, STAGING_DAMAGE_MAX),
      cooldownMs: clampNumber(Math.round(known.cooldownMs), STAGING_FIRE_COOLDOWN_MIN_MS, STAGING_FIRE_COOLDOWN_MAX_MS),
      damageSource: "server_known_weapon",
      fallbackDamageUsed: false,
      pulseLaserDetected: known.key === "pulseLaser",
      requestedDamage: getRequestedDamageFromPayload(message)
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
    requestedDamage: getRequestedDamageFromPayload(message)
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
    // server-owned visual bots, then applies clamped shield-first test damage
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

    // Staging-only reward flow preparation. This validates a recent preview
    // and replies with applied:false; it never grants XP, credits, loot,
    // inventory, bounties, saves, Supabase writes, or progression.
    this.onMessage("reward:claim_preview", async (client, message = {}) => {
      await this.claimRewardPreview(client, message, "reward:claim_preview");
    });

    this.onMessage("staging:claimRewardPreview", async (client, message = {}) => {
      await this.claimRewardPreview(client, message, "staging:claimRewardPreview");
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
    this.state.players.set(client.sessionId, new LupenSectorPlayer({
      id: client.sessionId,
      sessionId: client.sessionId,
      // Staging identity is preparation metadata only. Only verified tokens
      // populate trusted ids; unverified/guest clients continue as session
      // based staging participants with no real reward authority.
      authStatus: getAuthStatus(verifiedIdentity),
      playerId: trustedPlayerId,
      supabaseUserId: verifiedIdentity.supabaseUserId || trustedPlayerId,
      trustedPlayerId,
      displayName,
      currentShipId: getSafeIdentityValue(options.currentShipId),
      shipName: getShipName(options),
      shipImage: getSafeShipImagePath(getShipImageValue(options)),
      shipClass: getSafeShipClass(options),
      equippedWeaponKey: getSafeWeaponKey(options.equippedWeaponKey || options.weaponKey),
      equippedWeaponKeys: Array.isArray(options.equippedWeaponKeys)
        ? options.equippedWeaponKeys.map((entry) => getSafeWeaponKey(entry)).filter(Boolean).slice(0, 6).join(",")
        : String(options.equippedWeaponKeys || "").split(",").map((entry) => getSafeWeaponKey(entry)).filter(Boolean).slice(0, 6).join(","),
      multiplayerMode: getSafeIdentityValue(options.multiplayerMode, "dev"),
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

  buildRewardPreviewPayload(bot, disabledBySessionId, contributionSummary, receivedAt = Date.now()) {
    const botId = getStringValue(bot?.id);
    const finalHitIdentity = this.getPlayerIdentitySnapshot(disabledBySessionId);
    const topContributorIdentity = this.getPlayerIdentitySnapshot(contributionSummary.topContributorSessionId);
    return {
      ok: true,
      rewardPreviewId: `${botId}:${receivedAt}`,
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
      applied: false,
      reason: "staging_preview_only",
      dryRun: true,
      receivedAt
    };
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
      applied: false,
      mode: claimStatus.mode,
      xpDelta: claimStatus.xpDelta,
      dryRun: true,
      reason: "staging_preview_only",
      debugReason: claimStatus.debugReason,
      messageType,
      sessionId: client.sessionId,
      claimedBySessionId: client.sessionId,
      claimSimulated: true,
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

      client.send("stagingTrade:sellResult", {
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

    client.send(`stagingTrade:${operation}Result`, {
      ...result,
      reason: stagingModeBlockedWrite
        ? "staging_mode_required_for_trade_write"
        : sellDestinationBlocked
          ? "invalid_staging_trade_sell_destination"
          : result.reason,
      debugReason: stagingModeBlockedWrite
        ? "client_join_mode_was_not_staging"
        : sellDestinationBlocked
          ? `player_node_${playerNode || "unknown"}_does_not_match_${offer?.sellNode || "unknown"}`
          : result.debugReason,
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
    const trustedState = await fetchPlayerTradeValidationState({
      authStatus: identity.authStatus,
      trustedPlayerId: identity.trustedPlayerId,
      playerId: identity.playerId
    });
    const envGate = getLoadoutWriteEnvGate(identity.trustedPlayerId || identity.playerId, itemId);
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
      operation: "equip",
      applied: false,
      dryRun: true,
      itemId,
      name: itemId === "gun:pulseLaser" ? "Pulse Laser" : itemId === "attachment:cargoPod" ? "Cargo Pod" : "",
      category: itemId === "gun:pulseLaser" ? "weapon" : "equipment",
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
      plan = buildStagingLoadoutEquipPlan(trustedState.rawSaveData, { itemId });
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
        ? `Would equip ${base.name || "staging item"}. Dry run only - loadout not changed.`
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

    const resolvedWeapon = resolveStagingWeapon(message, player);
    const stagingDamage = resolvedWeapon.damage;
    const stagingCooldownMs = resolvedWeapon.cooldownMs;
    const result = this.applyStagingTestDamage(targetBot, stagingDamage);
    player.lastFireAt = now;
    player.nextFireAt = now + stagingCooldownMs;

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
    // grants rewards, progression, saves, PvP, or player damage.
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
      shield: result.shield,
      hull: result.hull,
      disabled: result.disabled,
      rewardsGranted: false,
      timestamp: resolvedAt,
      receivedAt: resolvedAt
    });

    if (result.disabled) {
      const contributionSummary = this.getContributionSummary(targetBot.id);
      const rewardPreview = this.buildRewardPreviewPayload(targetBot, client.sessionId, contributionSummary, Date.now());
      this.rewardPreviews.set(targetBot.id, rewardPreview);

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

    const x = Number(message.x);
    const y = Number(message.y);
    if (Number.isFinite(x)) player.x = x;
    if (Number.isFinite(y)) player.y = y;

    const displayName = getStringValue(message.displayName);
    if (displayName) player.displayName = displayName;

    // Presence updates may refresh display-only identity labels, but they do
    // not upgrade trusted identity. Only onJoin token verification can do that.

    if (typeof message.currentShipId === "string") {
      player.currentShipId = message.currentShipId.trim();
    }

    if (typeof message.shipName === "string" || typeof message.ship === "string") {
      player.shipName = getShipName(message);
    }

    if (typeof message.shipImage === "string" || typeof message.shipImageSrc === "string" || typeof message.shipImagePath === "string") {
      player.shipImage = getSafeShipImagePath(getShipImageValue(message));
    }

    if (typeof message.shipClass === "string" || typeof message.shipType === "string" || typeof message.shipRole === "string") {
      player.shipClass = getSafeShipClass(message);
    }

    const weaponKey = getSafeWeaponKey(message.equippedWeaponKey || message.weaponKey);
    if (weaponKey) player.equippedWeaponKey = weaponKey;

    const weaponKeys = Array.isArray(message.equippedWeaponKeys)
      ? message.equippedWeaponKeys.map((entry) => getSafeWeaponKey(entry)).filter(Boolean)
      : String(message.equippedWeaponKeys || "").split(",").map((entry) => getSafeWeaponKey(entry)).filter(Boolean);
    if (weaponKeys.length) player.equippedWeaponKeys = weaponKeys.slice(0, 6).join(",");

    const currentNode = getStringValue(message.currentNode);
    if (currentNode) player.currentNode = currentNode;
    this.reconcilePlayerSelection(player);
  }
}
