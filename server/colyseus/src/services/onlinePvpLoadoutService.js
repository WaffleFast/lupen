/* Read-only trusted combat loadout derivation for production multiplayer.
   The browser may report its currently displayed ship and weapons, but online
   combat authority comes from the verified account's persisted player_saves
   snapshot. No save data is written by this service. */

import { STAGING_SHIP_CONFIG } from "../config/stagingShipConfig.js";
import { fetchPlayerTradeValidationState } from "./playerSaveReadService.js";

const MAX_ITEM_LEVEL = 5;
const QUALITY_MULTIPLIERS = Object.freeze({
  standard: 1,
  refined: 1.08,
  unique: 1.08,
  advanced: 1.16,
  elite: 1.28,
  legendary: 1.42,
  godlike: 1.6
});
const DEFENSIVE_ATTACHMENT_EFFECTS = Object.freeze({
  hullBooster: Object.freeze({ hull: 100 }),
  shieldBooster: Object.freeze({ shield: 50 })
});

function getString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

function normalizeQuality(value = "standard") {
  const quality = getString(value, "standard").toLowerCase();
  return QUALITY_MULTIPLIERS[quality] ? quality : "standard";
}

function normalizeLoadoutEntry(entry) {
  const key = getString(typeof entry === "string" ? entry : entry?.key);
  if (!key || !/^[A-Za-z0-9_-]{1,48}$/.test(key)) return null;
  return {
    key,
    quality: normalizeQuality(typeof entry === "string" ? "standard" : entry?.quality),
    level: clampInteger(typeof entry === "string" ? 1 : entry?.level, 1, MAX_ITEM_LEVEL, 1)
  };
}

function getItemMultiplier(entry = {}) {
  const qualityMultiplier = QUALITY_MULTIPLIERS[normalizeQuality(entry.quality)] || 1;
  const levelMultiplier = 1 + Math.max(0, clampInteger(entry.level, 1, MAX_ITEM_LEVEL, 1) - 1) * 0.045;
  return qualityMultiplier * levelMultiplier;
}

function getLoadoutForShip(saveData = {}, shipId = "") {
  const loadouts = saveData?.shipLoadouts;
  if (!loadouts || typeof loadouts !== "object" || Array.isArray(loadouts)) {
    return { guns: [], attachments: [] };
  }
  const loadout = loadouts[shipId];
  return loadout && typeof loadout === "object" && !Array.isArray(loadout)
    ? loadout
    : { guns: [], attachments: [] };
}

function unavailable(reason, extra = {}) {
  return {
    ok: false,
    available: false,
    trusted: false,
    reason,
    currentShipId: "",
    shipName: "",
    weapons: [],
    attachments: [],
    gunSlots: 0,
    attachmentSlots: 0,
    stats: null,
    ...extra
  };
}

export function deriveTrustedOnlineCombatLoadout(saveData = {}, options = {}) {
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return unavailable("save_data_missing_or_invalid");
  }

  const currentShipId = getString(saveData.currentShipId) ||
    getString(saveData.selectedFleetShipId) ||
    getString(saveData.selectedHangarShipId);
  if (!currentShipId) return unavailable("current_ship_missing");

  const ownedShips = Array.isArray(saveData.ownedShips)
    ? saveData.ownedShips.map((shipId) => getString(shipId)).filter(Boolean)
    : [];
  if (!ownedShips.includes(currentShipId)) {
    return unavailable("current_ship_not_owned", { requestedShipId: currentShipId });
  }

  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!ship) return unavailable("unknown_server_ship", { requestedShipId: currentShipId });

  const allowedWeaponKeys = options.allowedWeaponKeys instanceof Set
    ? options.allowedWeaponKeys
    : Array.isArray(options.allowedWeaponKeys)
      ? new Set(options.allowedWeaponKeys)
      : null;
  const gunSlots = clampInteger(ship.gunSlots, 0, 20, 0);
  const attachmentSlots = clampInteger(ship.attachmentSlots, 0, 20, 0);
  const loadout = getLoadoutForShip(saveData, currentShipId);
  const weapons = (Array.isArray(loadout.guns) ? loadout.guns : [])
    .slice(0, gunSlots)
    .map(normalizeLoadoutEntry)
    .filter((entry) => entry && (!allowedWeaponKeys || allowedWeaponKeys.has(entry.key)));
  const attachments = (Array.isArray(loadout.attachments) ? loadout.attachments : [])
    .slice(0, attachmentSlots)
    .map(normalizeLoadoutEntry)
    .filter(Boolean);

  const stats = {
    hull: clampInteger(ship.hull, 1, 10000, 1),
    shield: clampInteger(ship.shield, 1, 10000, 1),
    armor: clampInteger(ship.armor, 0, 10000, 0)
  };
  attachments.forEach((entry) => {
    const effect = DEFENSIVE_ATTACHMENT_EFFECTS[entry.key];
    if (!effect) return;
    const multiplier = getItemMultiplier(entry);
    stats.hull += Math.max(0, Math.round(Number(effect.hull || 0) * multiplier));
    stats.shield += Math.max(0, Math.round(Number(effect.shield || 0) * multiplier));
  });

  return {
    ok: true,
    available: true,
    trusted: true,
    reason: "trusted_online_loadout_ready",
    currentShipId,
    shipName: getString(ship.name, currentShipId),
    weapons,
    attachments,
    gunSlots,
    attachmentSlots,
    stats,
    source: "verified_player_save"
  };
}

export async function fetchTrustedOnlineCombatLoadout(identity = {}, options = {}) {
  const trustedState = await fetchPlayerTradeValidationState(identity, options);
  const playerId = getString(identity.trustedPlayerId || identity.playerId || trustedState?.playerId);
  if (!trustedState?.rawSaveData) {
    return unavailable(trustedState?.reason || "trusted_save_unavailable", {
      playerId,
      status: Number(trustedState?.status || 0),
      updatedAt: getString(trustedState?.updatedAt)
    });
  }

  const derived = deriveTrustedOnlineCombatLoadout(trustedState.rawSaveData, options);
  return {
    ...derived,
    playerId,
    status: Number(trustedState?.status || 0),
    updatedAt: getString(trustedState?.updatedAt),
    saveReadReason: getString(trustedState?.reason)
  };
}

export function getTrustedWeaponDamageMultiplier(entry = {}) {
  return getItemMultiplier(entry);
}

