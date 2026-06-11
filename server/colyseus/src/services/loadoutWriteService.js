/* Staging-only loadout equip prototype.
   This service mirrors the current local standard equip behavior for current
   Map 1 Store guns and attachments only. Equipment equip writes decrement the
   matching owned count and append a standard level-1 entry; unequip writes
   reverse that for supported equipment. Ship selection writes only current ship
   selection fields. It preserves every unrelated save field and never writes credits,
   inventoryItems, ships, loot, bounties, PvP/player damage, broad progression,
   schema, or RLS. */

import { STAGING_SHIP_CONFIG } from "../config/stagingShipConfig.js";

const PLAYER_SAVES_TABLE = "player_saves";
const CARGO_POD_ITEM_ID = "attachment:cargoPod";
const CARGO_POD_KEY = "cargoPod";
const CARGO_POD_CARGO_BONUS = 25;
const SHIELD_BOOSTER_ITEM_ID = "attachment:shieldBooster";
const SHIELD_BOOSTER_KEY = "shieldBooster";
const SHIELD_BOOSTER_SHIELD_BONUS = 50;
const PULSE_LASER_ITEM_ID = "gun:pulseLaser";
const PULSE_LASER_KEY = "pulseLaser";
const STAGING_SHIP_ITEMS = Object.freeze([
  Object.freeze({ itemId: "ship:falcon", key: "falcon", name: "Azure Striker" }),
  Object.freeze({ itemId: "ship:bison", key: "bison", name: "Buu Hauler" }),
  Object.freeze({ itemId: "ship:monolith", key: "monolith", name: "Majin Vindicator" }),
  Object.freeze({ itemId: "ship:zeusExplorer", key: "zeusExplorer", name: "Nightshade Hawk" }),
  Object.freeze({ itemId: "ship:hephaestusTrader", key: "hephaestusTrader", name: "Champa Carrier" }),
  Object.freeze({ itemId: "ship:poseidonAggressor", key: "poseidonAggressor", name: "Silver Instinct" })
]);
const MAX_ATTACHMENT_COUNT = 9999;
const MAX_GUN_COUNT = 9999;

const STAGING_LOADOUT_ITEMS = Object.freeze([
  Object.freeze({ itemId: "gun:heavyLance", key: "heavyLance", name: "Heavy Lance", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: "gun:ionBlaster", key: "ionBlaster", name: "Ion Blaster", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: "gun:meltCannon", key: "meltCannon", name: "Melt Cannon", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: PULSE_LASER_ITEM_ID, key: PULSE_LASER_KEY, name: "Pulse Laser", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: "gun:repeater", key: "repeater", name: "Repeater", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: "gun:ripperGun", key: "ripperGun", name: "Ripper Gun", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: "gun:voidRail", key: "voidRail", name: "Void Rail", category: "weapon", listName: "guns", ownedPath: "ownedGuns", writeKind: "weapon" }),
  Object.freeze({ itemId: CARGO_POD_ITEM_ID, key: CARGO_POD_KEY, name: "Cargo Pod", category: "equipment", listName: "attachments", ownedPath: "ownedAttachments", writeKind: "attachment" }),
  Object.freeze({ itemId: "attachment:hullBooster", key: "hullBooster", name: "Hull Booster", category: "equipment", listName: "attachments", ownedPath: "ownedAttachments", writeKind: "attachment" }),
  Object.freeze({ itemId: "attachment:jumpDrive", key: "jumpDrive", name: "Jump Drive", category: "equipment", listName: "attachments", ownedPath: "ownedAttachments", writeKind: "attachment" }),
  Object.freeze({ itemId: SHIELD_BOOSTER_ITEM_ID, key: SHIELD_BOOSTER_KEY, name: "Shield Booster", category: "equipment", listName: "attachments", ownedPath: "ownedAttachments", writeKind: "attachment" }),
  Object.freeze({ itemId: "attachment:evasionMatrix", key: "evasionMatrix", name: "Evasion Matrix", category: "equipment", listName: "attachments", ownedPath: "ownedAttachments", writeKind: "attachment" })
]);

export const STAGING_LOADOUT_ITEM_IDS = Object.freeze([
  ...STAGING_LOADOUT_ITEMS.map((item) => item.itemId),
  ...STAGING_SHIP_ITEMS.map((item) => item.itemId)
]);
const DEFAULT_ALLOWED_LOADOUT_ITEMS = STAGING_LOADOUT_ITEM_IDS.join(",");

function getString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInteger(value, min, max) {
  const number = getFiniteNumber(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function getCsvSet(value = "") {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function getCatalogAllowedSet(value = "", catalogCsv = "") {
  const safeValue = getString(value).toLowerCase();
  if (!safeValue || safeValue === "catalog") return getCsvSet(catalogCsv);
  return getCsvSet(value);
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getString(env.SUPABASE_URL),
    serviceRoleKey: getString(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function getValidSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_err) {
    return "";
  }
}

function getPlayerSaveUrl(baseUrl, playerId) {
  return `${baseUrl}/rest/v1/${PLAYER_SAVES_TABLE}?user_id=eq.${encodeURIComponent(playerId)}`;
}

function getPlayerSaveReadUrl(baseUrl, playerId) {
  return `${getPlayerSaveUrl(baseUrl, playerId)}&select=save_data,updated_at&limit=1`;
}

function getSaveDataFromRow(row = {}) {
  return row?.save_data && typeof row.save_data === "object" && !Array.isArray(row.save_data)
    ? row.save_data
    : null;
}

function getLoadoutWriteFlags(applied = false, writeKind = "") {
  return {
    loadoutWritten: applied && writeKind !== "ship",
    attachmentWritten: applied && writeKind === "attachment",
    saveWritten: applied,
    inventoryWritten: false,
    creditsWritten: false,
    shipWritten: applied && writeKind === "ship",
    weaponWritten: applied && writeKind === "weapon",
    lootWritten: false,
    bountyWritten: false
  };
}

function getUserReason(reason) {
  const labels = {
    staging_loadout_writes_disabled: "Loadout writes are disabled in staging.",
    staging_loadout_dry_run_enabled: "Dry run only - loadout not changed.",
    verified_identity_required: "Verified staging identity required.",
    staging_loadout_write_allowlist_missing: "Loadout write allowlist is missing.",
    player_not_in_staging_loadout_write_allowlist: "Player is not allowlisted for staging loadout writes.",
    unknown_loadout_item: "Server loadout preview unavailable for this item.",
    loadout_item_not_allowed: "This item is not enabled for staging loadout writes.",
    trusted_save_required: "Trusted player save read required.",
    player_save_missing: "Player save not found.",
    player_save_read_failed: "Player save read failed.",
    player_save_patch_failed: "Player save patch failed.",
    current_ship_missing_or_invalid: "Current ship path is missing or invalid.",
    unsupported_ship_for_loadout_preview: "Current ship is not supported by staging loadout preview.",
    owned_attachments_path_missing_or_invalid: "Saved attachment ownership path is missing or invalid.",
    equipment_not_owned: "No owned copy is available to equip.",
    cargo_pod_not_owned: "No owned Cargo Pod is available to equip.",
    shield_booster_not_owned: "No owned Shield Booster is available to equip.",
    owned_guns_path_missing_or_invalid: "Saved weapon ownership path is missing or invalid.",
    pulse_laser_not_owned: "No owned Pulse Laser is available to equip.",
    equipment_not_equipped: "No equipped copy is available to unequip.",
    cargo_pod_not_equipped: "No equipped Cargo Pod is available to unequip.",
    shield_booster_not_equipped: "No equipped Shield Booster is available to unequip.",
    pulse_laser_not_equipped: "No equipped Pulse Laser is available to unequip.",
    owned_ships_path_missing_or_invalid: "Saved ship ownership path is missing or invalid.",
    ship_not_owned: "Ship is not owned yet.",
    ship_already_equipped: "Ship is already active.",
    ship_loadouts_path_missing_or_invalid: "Saved ship loadouts path is missing or invalid.",
    current_ship_loadout_missing_or_invalid: "Current ship loadout path is missing or invalid.",
    attachment_slots_full: "No empty attachment slot.",
    gun_slots_full: "No empty gun slot.",
    supabase_config_missing: "Supabase server config unavailable."
  };
  return labels[reason] || `Blocked: ${reason || "loadout write unavailable"}.`;
}

function blocked(reason, extra = {}) {
  return {
    ok: false,
    mode: "blocked",
    operation: "equip",
    applied: false,
    dryRun: true,
    blockReason: reason,
    userReason: getUserReason(reason),
    writes: getLoadoutWriteFlags(false),
    ...getLoadoutWriteFlags(false),
    ...extra
  };
}

function getLoadoutItemMeta(itemId) {
  const safeItemId = getString(itemId);
  const item = STAGING_LOADOUT_ITEMS.find((entry) => entry.itemId === safeItemId);
  if (!item) return null;
  const specificUnequippedReason = isCargoPodItem(safeItemId)
    ? "cargo_pod_not_equipped"
    : isShieldBoosterItem(safeItemId)
      ? "shield_booster_not_equipped"
      : isPulseLaserItem(safeItemId)
        ? "pulse_laser_not_equipped"
        : "equipment_not_equipped";
  return {
    ...item,
    unequippedReason: specificUnequippedReason
  };
}

function isCargoPodItem(itemId) {
  return getString(itemId) === CARGO_POD_ITEM_ID;
}

function isShieldBoosterItem(itemId) {
  return getString(itemId) === SHIELD_BOOSTER_ITEM_ID;
}

function isPulseLaserItem(itemId) {
  return getString(itemId) === PULSE_LASER_ITEM_ID;
}

function getStagingShipItemMeta(itemId) {
  const safeItemId = getString(itemId);
  return STAGING_SHIP_ITEMS.find((entry) => entry.itemId === safeItemId) || null;
}

function isStagingShipItem(itemId) {
  return Boolean(getStagingShipItemMeta(itemId));
}

function normalizeLoadoutEntry(entry) {
  if (typeof entry === "string") return { key: entry, quality: "standard", level: 1 };
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const key = getString(entry.key);
  if (!key) return null;
  return {
    key,
    quality: getString(entry.quality, "standard") || "standard",
    level: clampInteger(entry.level || 1, 1, 99) || 1
  };
}

function getCargoPodCount(entries = []) {
  return entries.reduce((count, entry) => {
    const normalized = normalizeLoadoutEntry(entry);
    return count + (normalized?.key === CARGO_POD_KEY ? 1 : 0);
  }, 0);
}

function getShieldBoosterCount(entries = []) {
  return entries.reduce((count, entry) => {
    const normalized = normalizeLoadoutEntry(entry);
    return count + (normalized?.key === SHIELD_BOOSTER_KEY ? 1 : 0);
  }, 0);
}

function getPulseLaserCount(entries = []) {
  return entries.reduce((count, entry) => {
    const normalized = normalizeLoadoutEntry(entry);
    return count + (normalized?.key === PULSE_LASER_KEY ? 1 : 0);
  }, 0);
}

function getCargoCapacity(saveData, shipId, attachments = []) {
  const ship = STAGING_SHIP_CONFIG[shipId];
  if (!ship) return null;
  return ship.cargo + getCargoPodCount(attachments) * CARGO_POD_CARGO_BONUS;
}

function getShieldCapacity(saveData, shipId, attachments = []) {
  const ship = STAGING_SHIP_CONFIG[shipId];
  if (!ship) return null;
  return ship.shield + getShieldBoosterCount(attachments) * SHIELD_BOOSTER_SHIELD_BONUS;
}

export function getLoadoutWriteEnvGate(playerId, itemId = CARGO_POD_ITEM_ID, env = process.env) {
  const scope = getString(env.STAGING_LOADOUT_WRITE_SCOPE, "disabled").toLowerCase();
  const normalizedScope = scope === "verified" || scope === "allowlist" ? scope : "disabled";
  const allowlist = getCsvSet(env.STAGING_LOADOUT_WRITE_ALLOWLIST);
  const allowedItems = getCatalogAllowedSet(env.STAGING_LOADOUT_WRITE_ALLOWED_ITEMS, DEFAULT_ALLOWED_LOADOUT_ITEMS);
  const playerAllowed = normalizedScope === "verified"
    ? !!playerId
    : !!playerId && allowlist.has(playerId);

  return {
    writeEnabled: getBooleanEnv(env.STAGING_LOADOUT_WRITE_ENABLED, false),
    dryRun: getBooleanEnv(env.STAGING_LOADOUT_WRITE_DRY_RUN, true),
    scope: normalizedScope,
    allowlistPresent: allowlist.size > 0,
    allowlisted: playerAllowed,
    playerAllowed,
    itemAllowed: allowedItems.has(itemId),
    allowedItemCount: allowedItems.size
  };
}

function buildStagingEquipmentEquipPlan(saveData = {}, { itemId = CARGO_POD_ITEM_ID } = {}) {
  const meta = getLoadoutItemMeta(itemId);
  if (!meta) return blocked("unknown_loadout_item", { itemId });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId: meta.itemId });

  const currentShipId = getString(saveData.currentShipId);
  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId: meta.itemId });
  if (!ship) return blocked("unsupported_ship_for_loadout_preview", { itemId: meta.itemId, currentShipId });

  const ownedStore = saveData[meta.ownedPath];
  if (!ownedStore || typeof ownedStore !== "object" || Array.isArray(ownedStore)) {
    return blocked(meta.ownedPath === "ownedGuns" ? "owned_guns_path_missing_or_invalid" : "owned_attachments_path_missing_or_invalid", {
      itemId: meta.itemId,
      currentShipId
    });
  }

  const maxCount = meta.ownedPath === "ownedGuns" ? MAX_GUN_COUNT : MAX_ATTACHMENT_COUNT;
  const ownedBefore = clampInteger(ownedStore[meta.key] || 0, 0, maxCount);
  if (ownedBefore === null || ownedBefore <= 0) {
    const legacyReason = isCargoPodItem(meta.itemId)
      ? "cargo_pod_not_owned"
      : isShieldBoosterItem(meta.itemId)
        ? "shield_booster_not_owned"
        : isPulseLaserItem(meta.itemId)
          ? "pulse_laser_not_owned"
          : "equipment_not_owned";
    return blocked(legacyReason, { itemId: meta.itemId, currentShipId, ownedBefore: ownedBefore || 0 });
  }

  if (!saveData.shipLoadouts || typeof saveData.shipLoadouts !== "object" || Array.isArray(saveData.shipLoadouts)) {
    return blocked("ship_loadouts_path_missing_or_invalid", { itemId: meta.itemId, currentShipId, ownedBefore });
  }

  const loadout = saveData.shipLoadouts[currentShipId];
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout) || !Array.isArray(loadout.attachments) || !Array.isArray(loadout.guns)) {
    return blocked("current_ship_loadout_missing_or_invalid", { itemId: meta.itemId, currentShipId, ownedBefore });
  }

  const slotLimit = meta.listName === "guns" ? ship.gunSlots : ship.attachmentSlots;
  const slotReason = meta.listName === "guns" ? "gun_slots_full" : "attachment_slots_full";
  const normalizedEntries = loadout[meta.listName].map(normalizeLoadoutEntry).filter(Boolean);
  const equippedBefore = normalizedEntries.filter((entry) => entry.key === meta.key).length;
  if (normalizedEntries.length >= slotLimit) {
    return blocked(slotReason, {
      itemId: meta.itemId,
      currentShipId,
      ownedBefore,
      ownedAfter: ownedBefore,
      equippedBefore,
      equippedAfter: equippedBefore,
      gunSlots: meta.listName === "guns" ? ship.gunSlots : undefined,
      attachmentSlots: meta.listName === "attachments" ? ship.attachmentSlots : undefined,
      cargoCapacityBefore: meta.key === CARGO_POD_KEY ? getCargoCapacity(saveData, currentShipId, normalizedEntries) : undefined,
      cargoCapacityAfterPreview: meta.key === CARGO_POD_KEY ? getCargoCapacity(saveData, currentShipId, normalizedEntries) : undefined,
      shieldBefore: meta.key === SHIELD_BOOSTER_KEY ? getShieldCapacity(saveData, currentShipId, normalizedEntries) : undefined,
      shieldAfterPreview: meta.key === SHIELD_BOOSTER_KEY ? getShieldCapacity(saveData, currentShipId, normalizedEntries) : undefined
    });
  }

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData[meta.ownedPath][meta.key] = Math.max(0, ownedBefore - 1);
  patchedSaveData.shipLoadouts[currentShipId][meta.listName] = [
    ...normalizedEntries,
    { key: meta.key, quality: "standard", level: 1 }
  ];

  const result = {
    ok: true,
    mode: "loadout_write_plan",
    operation: "equip",
    applied: false,
    dryRun: true,
    itemId: meta.itemId,
    name: meta.name,
    category: meta.category,
    currentShipId,
    ownedBefore,
    ownedAfter: patchedSaveData[meta.ownedPath][meta.key],
    equippedBefore,
    equippedAfter: equippedBefore + 1,
    gunSlots: meta.listName === "guns" ? ship.gunSlots : undefined,
    attachmentSlots: meta.listName === "attachments" ? ship.attachmentSlots : undefined,
    patchedSaveData,
    appliedFields: [`${meta.ownedPath}.${meta.key}`, `shipLoadouts.${currentShipId}.${meta.listName}`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };

  if (meta.key === CARGO_POD_KEY) {
    result.cargoCapacityBefore = getCargoCapacity(saveData, currentShipId, normalizedEntries);
    result.cargoCapacityAfterPreview = getCargoCapacity(patchedSaveData, currentShipId, patchedSaveData.shipLoadouts[currentShipId].attachments);
    result.cargoCapacityAfter = result.cargoCapacityAfterPreview;
  }
  if (meta.key === SHIELD_BOOSTER_KEY) {
    result.shieldBefore = getShieldCapacity(saveData, currentShipId, normalizedEntries);
    result.shieldAfterPreview = getShieldCapacity(patchedSaveData, currentShipId, patchedSaveData.shipLoadouts[currentShipId].attachments);
    result.shieldAfter = result.shieldAfterPreview;
  }

  return result;
}

export function buildStagingCargoPodEquipPlan(saveData = {}, { itemId = CARGO_POD_ITEM_ID } = {}) {
  if (!isCargoPodItem(itemId)) return blocked("unknown_loadout_item", { itemId });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId });

  const currentShipId = getString(saveData.currentShipId);
  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId });
  if (!ship) return blocked("unsupported_ship_for_loadout_preview", { itemId, currentShipId });

  if (!saveData.ownedAttachments || typeof saveData.ownedAttachments !== "object" || Array.isArray(saveData.ownedAttachments)) {
    return blocked("owned_attachments_path_missing_or_invalid", { itemId, currentShipId });
  }

  const ownedBefore = clampInteger(saveData.ownedAttachments[CARGO_POD_KEY], 0, MAX_ATTACHMENT_COUNT);
  if (ownedBefore === null || ownedBefore <= 0) return blocked("cargo_pod_not_owned", { itemId, currentShipId, ownedBefore: ownedBefore || 0 });

  if (!saveData.shipLoadouts || typeof saveData.shipLoadouts !== "object" || Array.isArray(saveData.shipLoadouts)) {
    return blocked("ship_loadouts_path_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const loadout = saveData.shipLoadouts[currentShipId];
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout) || !Array.isArray(loadout.attachments) || !Array.isArray(loadout.guns)) {
    return blocked("current_ship_loadout_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const normalizedAttachments = loadout.attachments.map(normalizeLoadoutEntry).filter(Boolean);
  const equippedBefore = getCargoPodCount(normalizedAttachments);
  if (normalizedAttachments.length >= ship.attachmentSlots) {
    return blocked("attachment_slots_full", {
      itemId,
      currentShipId,
      ownedBefore,
      ownedAfter: ownedBefore,
      equippedBefore,
      equippedAfter: equippedBefore,
      cargoCapacityBefore: getCargoCapacity(saveData, currentShipId, normalizedAttachments),
      cargoCapacityAfterPreview: getCargoCapacity(saveData, currentShipId, normalizedAttachments)
    });
  }

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.ownedAttachments[CARGO_POD_KEY] = Math.max(0, ownedBefore - 1);
  patchedSaveData.shipLoadouts[currentShipId].attachments = [
    ...normalizedAttachments,
    { key: CARGO_POD_KEY, quality: "standard", level: 1 }
  ];

  const cargoCapacityBefore = getCargoCapacity(saveData, currentShipId, normalizedAttachments);
  const cargoCapacityAfter = getCargoCapacity(patchedSaveData, currentShipId, patchedSaveData.shipLoadouts[currentShipId].attachments);

  return {
    ok: true,
    mode: "loadout_write_plan",
    operation: "equip",
    applied: false,
    dryRun: true,
    itemId: CARGO_POD_ITEM_ID,
    name: "Cargo Pod",
    category: "equipment",
    currentShipId,
    ownedBefore,
    ownedAfter: patchedSaveData.ownedAttachments[CARGO_POD_KEY],
    equippedBefore,
    equippedAfter: equippedBefore + 1,
    cargoCapacityBefore,
    cargoCapacityAfterPreview: cargoCapacityAfter,
    cargoCapacityAfter,
    patchedSaveData,
    appliedFields: ["ownedAttachments.cargoPod", `shipLoadouts.${currentShipId}.attachments`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "ownedGuns", "guns", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };
}

export function buildStagingShieldBoosterEquipPlan(saveData = {}, { itemId = SHIELD_BOOSTER_ITEM_ID } = {}) {
  if (!isShieldBoosterItem(itemId)) return blocked("unknown_loadout_item", { itemId });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId });

  const currentShipId = getString(saveData.currentShipId);
  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId });
  if (!ship) return blocked("unsupported_ship_for_loadout_preview", { itemId, currentShipId });

  if (!saveData.ownedAttachments || typeof saveData.ownedAttachments !== "object" || Array.isArray(saveData.ownedAttachments)) {
    return blocked("owned_attachments_path_missing_or_invalid", { itemId, currentShipId });
  }

  const ownedBefore = clampInteger(saveData.ownedAttachments[SHIELD_BOOSTER_KEY], 0, MAX_ATTACHMENT_COUNT);
  if (ownedBefore === null || ownedBefore <= 0) return blocked("shield_booster_not_owned", { itemId, currentShipId, ownedBefore: ownedBefore || 0 });

  if (!saveData.shipLoadouts || typeof saveData.shipLoadouts !== "object" || Array.isArray(saveData.shipLoadouts)) {
    return blocked("ship_loadouts_path_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const loadout = saveData.shipLoadouts[currentShipId];
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout) || !Array.isArray(loadout.attachments) || !Array.isArray(loadout.guns)) {
    return blocked("current_ship_loadout_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const normalizedAttachments = loadout.attachments.map(normalizeLoadoutEntry).filter(Boolean);
  const equippedBefore = getShieldBoosterCount(normalizedAttachments);
  if (normalizedAttachments.length >= ship.attachmentSlots) {
    return blocked("attachment_slots_full", {
      itemId,
      currentShipId,
      ownedBefore,
      ownedAfter: ownedBefore,
      equippedBefore,
      equippedAfter: equippedBefore,
      shieldBefore: getShieldCapacity(saveData, currentShipId, normalizedAttachments),
      shieldAfterPreview: getShieldCapacity(saveData, currentShipId, normalizedAttachments)
    });
  }

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.ownedAttachments[SHIELD_BOOSTER_KEY] = Math.max(0, ownedBefore - 1);
  patchedSaveData.shipLoadouts[currentShipId].attachments = [
    ...normalizedAttachments,
    { key: SHIELD_BOOSTER_KEY, quality: "standard", level: 1 }
  ];

  const shieldBefore = getShieldCapacity(saveData, currentShipId, normalizedAttachments);
  const shieldAfter = getShieldCapacity(patchedSaveData, currentShipId, patchedSaveData.shipLoadouts[currentShipId].attachments);

  return {
    ok: true,
    mode: "loadout_write_plan",
    operation: "equip",
    applied: false,
    dryRun: true,
    itemId: SHIELD_BOOSTER_ITEM_ID,
    name: "Shield Booster",
    category: "equipment",
    currentShipId,
    ownedBefore,
    ownedAfter: patchedSaveData.ownedAttachments[SHIELD_BOOSTER_KEY],
    equippedBefore,
    equippedAfter: equippedBefore + 1,
    shieldBefore,
    shieldAfterPreview: shieldAfter,
    shieldAfter,
    patchedSaveData,
    appliedFields: ["ownedAttachments.shieldBooster", `shipLoadouts.${currentShipId}.attachments`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "ownedGuns", "guns", "cargo", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };
}

export function buildStagingPulseLaserEquipPlan(saveData = {}, { itemId = PULSE_LASER_ITEM_ID } = {}) {
  if (!isPulseLaserItem(itemId)) return blocked("unknown_loadout_item", { itemId });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId });

  const currentShipId = getString(saveData.currentShipId);
  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId });
  if (!ship) return blocked("unsupported_ship_for_loadout_preview", { itemId, currentShipId });

  if (!saveData.ownedGuns || typeof saveData.ownedGuns !== "object" || Array.isArray(saveData.ownedGuns)) {
    return blocked("owned_guns_path_missing_or_invalid", { itemId, currentShipId });
  }

  const ownedBefore = clampInteger(saveData.ownedGuns[PULSE_LASER_KEY], 0, MAX_GUN_COUNT);
  if (ownedBefore === null || ownedBefore <= 0) return blocked("pulse_laser_not_owned", { itemId, currentShipId, ownedBefore: ownedBefore || 0 });

  if (!saveData.shipLoadouts || typeof saveData.shipLoadouts !== "object" || Array.isArray(saveData.shipLoadouts)) {
    return blocked("ship_loadouts_path_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const loadout = saveData.shipLoadouts[currentShipId];
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout) || !Array.isArray(loadout.attachments) || !Array.isArray(loadout.guns)) {
    return blocked("current_ship_loadout_missing_or_invalid", { itemId, currentShipId, ownedBefore });
  }

  const normalizedGuns = loadout.guns.map(normalizeLoadoutEntry).filter(Boolean);
  const equippedBefore = getPulseLaserCount(normalizedGuns);
  if (normalizedGuns.length >= ship.gunSlots) {
    return blocked("gun_slots_full", {
      itemId,
      currentShipId,
      ownedBefore,
      ownedAfter: ownedBefore,
      equippedBefore,
      equippedAfter: equippedBefore,
      gunSlots: ship.gunSlots
    });
  }

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.ownedGuns[PULSE_LASER_KEY] = Math.max(0, ownedBefore - 1);
  patchedSaveData.shipLoadouts[currentShipId].guns = [
    ...normalizedGuns,
    { key: PULSE_LASER_KEY, quality: "standard", level: 1 }
  ];

  return {
    ok: true,
    mode: "loadout_write_plan",
    operation: "equip",
    applied: false,
    dryRun: true,
    itemId: PULSE_LASER_ITEM_ID,
    name: "Pulse Laser",
    category: "weapon",
    currentShipId,
    ownedBefore,
    ownedAfter: patchedSaveData.ownedGuns[PULSE_LASER_KEY],
    equippedBefore,
    equippedAfter: equippedBefore + 1,
    gunSlots: ship.gunSlots,
    patchedSaveData,
    appliedFields: ["ownedGuns.pulseLaser", `shipLoadouts.${currentShipId}.guns`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "ownedAttachments", "attachments", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };
}

export function buildStagingShipSelectPlan(saveData = {}, { itemId = "ship:falcon" } = {}) {
  const meta = getStagingShipItemMeta(itemId);
  if (!meta) return blocked("unknown_loadout_item", { itemId });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId });

  const currentShipId = getString(saveData.currentShipId);
  const currentShip = STAGING_SHIP_CONFIG[currentShipId] || null;
  const targetShipId = meta.key;
  const targetShip = STAGING_SHIP_CONFIG[targetShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId });
  if (!targetShip) return blocked("unsupported_ship_for_loadout_preview", { itemId, currentShipId });
  if (!Array.isArray(saveData.ownedShips)) return blocked("owned_ships_path_missing_or_invalid", { itemId, currentShipId });
  if (!saveData.ownedShips.includes(targetShipId)) return blocked("ship_not_owned", { itemId, currentShipId, targetShipId });
  if (currentShipId === targetShipId) return blocked("ship_already_equipped", { itemId, currentShipId, targetShipId });

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.currentShipId = targetShipId;
  patchedSaveData.selectedHangarShipId = targetShipId;
  if (Object.prototype.hasOwnProperty.call(patchedSaveData, "selectedFleetShipId")) {
    patchedSaveData.selectedFleetShipId = targetShipId;
  }
  patchedSaveData.shipLoadouts = patchedSaveData.shipLoadouts && typeof patchedSaveData.shipLoadouts === "object" && !Array.isArray(patchedSaveData.shipLoadouts)
    ? patchedSaveData.shipLoadouts
    : {};
  if (!patchedSaveData.shipLoadouts[targetShipId]) patchedSaveData.shipLoadouts[targetShipId] = { attachments: [], guns: [] };

  return {
    ok: true,
    mode: "loadout_write_plan",
    operation: "equip",
    applied: false,
    dryRun: true,
    itemId: meta.itemId,
    name: meta.name,
    category: "ship",
    currentShipId,
    targetShipId,
    selectedShipBefore: currentShipId,
    selectedShipAfter: targetShipId,
    cargoCapacityBefore: currentShip ? currentShip.cargo : null,
    cargoCapacityAfterPreview: targetShip.cargo,
    cargoCapacityAfter: targetShip.cargo,
    shieldBefore: currentShip ? currentShip.shield : null,
    shieldAfterPreview: targetShip.shield,
    shieldAfter: targetShip.shield,
    patchedSaveData,
    appliedFields: Object.prototype.hasOwnProperty.call(patchedSaveData, "selectedFleetShipId")
      ? ["currentShipId", "selectedHangarShipId", "selectedFleetShipId", `shipLoadouts.${targetShipId}`]
      : ["currentShipId", "selectedHangarShipId", `shipLoadouts.${targetShipId}`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "ownedAttachments", "ownedGuns", "attachments", "guns", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };
}

export function buildStagingLoadoutEquipPlan(saveData = {}, { itemId = CARGO_POD_ITEM_ID } = {}) {
  if (isStagingShipItem(itemId)) return buildStagingShipSelectPlan(saveData, { itemId });
  const meta = getLoadoutItemMeta(itemId);
  if (meta) return buildStagingEquipmentEquipPlan(saveData, { itemId });
  return blocked("unknown_loadout_item", { itemId });
}

export function buildStagingLoadoutUnequipPlan(saveData = {}, { itemId = CARGO_POD_ITEM_ID } = {}) {
  const meta = getLoadoutItemMeta(itemId);
  if (!meta) return blocked("unknown_loadout_item", { itemId, operation: "unequip" });
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) return blocked("save_data_missing_or_invalid", { itemId: meta.itemId, operation: "unequip" });

  const currentShipId = getString(saveData.currentShipId);
  const ship = STAGING_SHIP_CONFIG[currentShipId];
  if (!currentShipId) return blocked("current_ship_missing_or_invalid", { itemId: meta.itemId, operation: "unequip" });
  if (!ship) return blocked("unsupported_ship_for_loadout_preview", { itemId: meta.itemId, currentShipId, operation: "unequip" });

  const ownedStore = saveData[meta.ownedPath];
  if (!ownedStore || typeof ownedStore !== "object" || Array.isArray(ownedStore)) {
    return blocked(meta.ownedPath === "ownedGuns" ? "owned_guns_path_missing_or_invalid" : "owned_attachments_path_missing_or_invalid", {
      itemId: meta.itemId,
      currentShipId,
      operation: "unequip"
    });
  }

  if (!saveData.shipLoadouts || typeof saveData.shipLoadouts !== "object" || Array.isArray(saveData.shipLoadouts)) {
    return blocked("ship_loadouts_path_missing_or_invalid", { itemId: meta.itemId, currentShipId, operation: "unequip" });
  }

  const loadout = saveData.shipLoadouts[currentShipId];
  if (!loadout || typeof loadout !== "object" || Array.isArray(loadout) || !Array.isArray(loadout.attachments) || !Array.isArray(loadout.guns)) {
    return blocked("current_ship_loadout_missing_or_invalid", { itemId: meta.itemId, currentShipId, operation: "unequip" });
  }

  const normalizedEntries = loadout[meta.listName].map(normalizeLoadoutEntry).filter(Boolean);
  const removeIndex = normalizedEntries.findIndex((entry) => entry.key === meta.key && entry.quality === "standard" && Number(entry.level || 1) <= 1);
  const equippedBefore = normalizedEntries.filter((entry) => entry.key === meta.key).length;
  const ownedBefore = clampInteger(ownedStore[meta.key], 0, meta.ownedPath === "ownedGuns" ? MAX_GUN_COUNT : MAX_ATTACHMENT_COUNT) || 0;
  if (removeIndex < 0) {
    return blocked(meta.unequippedReason, {
      itemId: meta.itemId,
      currentShipId,
      operation: "unequip",
      ownedBefore,
      ownedAfter: ownedBefore,
      equippedBefore,
      equippedAfter: equippedBefore
    });
  }

  const patchedSaveData = cloneJson(saveData);
  const nextEntries = normalizedEntries.filter((_entry, index) => index !== removeIndex);
  patchedSaveData[meta.ownedPath][meta.key] = ownedBefore + 1;
  patchedSaveData.shipLoadouts[currentShipId][meta.listName] = nextEntries;

  const result = {
    ok: true,
    mode: "loadout_write_plan",
    operation: "unequip",
    applied: false,
    dryRun: true,
    itemId: meta.itemId,
    name: meta.name,
    category: meta.category,
    currentShipId,
    ownedBefore,
    ownedAfter: ownedBefore + 1,
    equippedBefore,
    equippedAfter: Math.max(0, equippedBefore - 1),
    patchedSaveData,
    appliedFields: [`${meta.ownedPath}.${meta.key}`, `shipLoadouts.${currentShipId}.${meta.listName}`],
    untouchedFields: ["credits", "inventoryItems", "ownedShips", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeCargo"]
  };

  if (meta.key === CARGO_POD_KEY) {
    result.cargoCapacityBefore = getCargoCapacity(saveData, currentShipId, normalizedEntries);
    result.cargoCapacityAfterPreview = getCargoCapacity(patchedSaveData, currentShipId, nextEntries);
    result.cargoCapacityAfter = result.cargoCapacityAfterPreview;
  }
  if (meta.key === SHIELD_BOOSTER_KEY) {
    result.shieldBefore = getShieldCapacity(saveData, currentShipId, normalizedEntries);
    result.shieldAfterPreview = getShieldCapacity(patchedSaveData, currentShipId, nextEntries);
    result.shieldAfter = result.shieldAfterPreview;
  }
  if (meta.key === PULSE_LASER_KEY) {
    result.gunSlots = ship.gunSlots;
  }

  return result;
}

async function fetchPlayerSaveRow(baseUrl, playerId, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveReadUrl(baseUrl, playerId), {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      accept: "application/json"
    }
  });

  if (!response?.ok) return { ok: false, reason: "player_save_read_failed", status: Number(response?.status || 0), row: null };
  const rows = typeof response.json === "function" ? await response.json() : [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return { ok: false, reason: "player_save_missing", status: Number(response.status || 200), row: null };
  return { ok: true, reason: "", status: Number(response.status || 200), row };
}

async function patchPlayerSaveData(baseUrl, playerId, saveData, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveUrl(baseUrl, playerId), {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify({ save_data: saveData })
  });

  if (!response?.ok) return { ok: false, reason: "player_save_patch_failed", status: Number(response?.status || 0) };
  return { ok: true, reason: "", status: Number(response.status || 200) };
}

export async function applyStagingLoadoutEquipWrite({
  playerId = "",
  itemId = CARGO_POD_ITEM_ID,
  operation = "equip",
  trustedState = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const safePlayerId = getString(playerId);
  const safeOperation = getString(operation, "equip") === "unequip" ? "unequip" : "equip";
  if (!safePlayerId) return blocked("verified_identity_required", { itemId });
  if (!STAGING_LOADOUT_ITEM_IDS.includes(itemId)) return blocked("unknown_loadout_item", { itemId });
  if (safeOperation === "unequip" && isStagingShipItem(itemId)) return blocked("unknown_loadout_item", { itemId, operation: safeOperation });
  if (!trustedState?.available || !trustedState?.validationState) return blocked("trusted_save_required", { itemId });
  if (typeof fetchImpl !== "function") return blocked("fetch_unavailable", { itemId });

  const envGate = getLoadoutWriteEnvGate(safePlayerId, itemId, env);
  if (!envGate.writeEnabled) return blocked("staging_loadout_writes_disabled", { envGate, itemId });
  if (envGate.dryRun) return blocked("staging_loadout_dry_run_enabled", { envGate, itemId });
  if (!envGate.itemAllowed) return blocked("loadout_item_not_allowed", { envGate, itemId });
  if (!envGate.playerAllowed) {
    return blocked(envGate.scope === "allowlist" && !envGate.allowlistPresent
      ? "staging_loadout_write_allowlist_missing"
      : "player_not_in_staging_loadout_write_allowlist", { envGate, itemId });
  }

  const config = getSupabaseConfig(env);
  const baseUrl = getValidSupabaseUrl(config.url);
  if (!baseUrl || !config.serviceRoleKey) return blocked("supabase_config_missing", { envGate, itemId });

  try {
    const readResult = await fetchPlayerSaveRow(baseUrl, safePlayerId, config, fetchImpl);
    if (!readResult.ok) return blocked(readResult.reason, { envGate, status: readResult.status, itemId });
    const saveData = getSaveDataFromRow(readResult.row);
    const plan = safeOperation === "unequip"
      ? buildStagingLoadoutUnequipPlan(saveData, { itemId })
      : buildStagingLoadoutEquipPlan(saveData, { itemId });
    if (!plan.ok) return { ...plan, envGate, itemId };
    const patchResult = await patchPlayerSaveData(baseUrl, safePlayerId, plan.patchedSaveData, config, fetchImpl);
    if (!patchResult.ok) return blocked(patchResult.reason, { envGate, status: patchResult.status, itemId });

    return {
      ok: true,
      mode: "loadout_write",
      operation: safeOperation,
      applied: true,
      dryRun: false,
      reason: safeOperation === "unequip"
        ? `${plan.name} unequipped`
        : isStagingShipItem(itemId)
        ? `${plan.name} selected`
        : `${plan.name} equipped`,
      debugReason: safeOperation === "unequip"
        ? `staging_${plan.name.toLowerCase().replace(/\s+/g, "_")}_unequip_applied`
        : isStagingShipItem(itemId)
        ? `phase_ship_staging_${plan.targetShipId}_select_applied`
        : `staging_${plan.name.toLowerCase().replace(/\s+/g, "_")}_equip_applied`,
      itemId: plan.itemId,
      name: plan.name,
      category: plan.category,
      currentShipId: plan.currentShipId,
      targetShipId: plan.targetShipId,
      selectedShipBefore: plan.selectedShipBefore,
      selectedShipAfter: plan.selectedShipAfter,
      ownedBefore: plan.ownedBefore,
      ownedAfter: plan.ownedAfter,
      equippedBefore: plan.equippedBefore,
      equippedAfter: plan.equippedAfter,
      cargoCapacityBefore: plan.cargoCapacityBefore,
      cargoCapacityAfterPreview: plan.cargoCapacityAfterPreview,
      cargoCapacityAfter: plan.cargoCapacityAfter,
      shieldBefore: plan.shieldBefore,
      shieldAfterPreview: plan.shieldAfterPreview,
      shieldAfter: plan.shieldAfter,
      gunSlots: plan.gunSlots,
      validationMode: "trusted_save",
      trustedStateAvailable: true,
      status: patchResult.status,
      gates: {
        verified: true,
        writeEnabled: envGate.writeEnabled,
        dryRun: envGate.dryRun,
        allowlisted: envGate.playerAllowed,
        scope: envGate.scope,
        trustedSaveAvailable: true,
        itemAllowed: envGate.itemAllowed
      },
      envGate,
      writes: getLoadoutWriteFlags(true, isStagingShipItem(itemId) ? "ship" : itemId.startsWith("gun:") ? "weapon" : "attachment"),
      ...getLoadoutWriteFlags(true, isStagingShipItem(itemId) ? "ship" : itemId.startsWith("gun:") ? "weapon" : "attachment"),
      appliedFields: plan.appliedFields
    };
  } catch (_err) {
    return blocked("staging_loadout_write_failed", { itemId, status: 0 });
  }
}

export async function applyStagingCargoPodEquipWrite(options = {}) {
  return applyStagingLoadoutEquipWrite({
    ...options,
    itemId: options.itemId || CARGO_POD_ITEM_ID
  });
}

export const LoadoutWriteService = Object.freeze({
  getLoadoutWriteEnvGate,
  buildStagingCargoPodEquipPlan,
  buildStagingShieldBoosterEquipPlan,
  buildStagingPulseLaserEquipPlan,
  buildStagingShipSelectPlan,
  buildStagingLoadoutEquipPlan,
  buildStagingLoadoutUnequipPlan,
  applyStagingCargoPodEquipWrite,
  applyStagingLoadoutEquipWrite
});
