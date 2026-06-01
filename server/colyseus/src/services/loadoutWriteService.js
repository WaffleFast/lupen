/* Staging-only Cargo Pod equip prototype.
   This service mirrors the current local standard attachment equip behavior for
   attachment:cargoPod only: decrement ownedAttachments.cargoPod, append a
   standard level-1 Cargo Pod to the current ship loadout, and preserve every
   unrelated save field. It never writes credits, inventoryItems, guns, ships,
   loot, bounties, PvP/player damage, broad progression, schema, or RLS. */

const PLAYER_SAVES_TABLE = "player_saves";
const CARGO_POD_ITEM_ID = "attachment:cargoPod";
const CARGO_POD_KEY = "cargoPod";
const CARGO_POD_CARGO_BONUS = 25;
const MAX_ATTACHMENT_COUNT = 9999;

const STAGING_SHIP_CONFIG = Object.freeze({
  lupenOrigin: Object.freeze({ cargo: 150, attachmentSlots: 3 }),
  lupenHauler: Object.freeze({ cargo: 260, attachmentSlots: 4 }),
  lupenStriker: Object.freeze({ cargo: 100, attachmentSlots: 3 }),
  hermesCourier: Object.freeze({ cargo: 190, attachmentSlots: 3 }),
  athenaSentinel: Object.freeze({ cargo: 140, attachmentSlots: 4 }),
  aresVindicator: Object.freeze({ cargo: 90, attachmentSlots: 3 }),
  hephaestusTrader: Object.freeze({ cargo: 360, attachmentSlots: 6 }),
  poseidonAggressor: Object.freeze({ cargo: 120, attachmentSlots: 4 }),
  zeusExplorer: Object.freeze({ cargo: 220, attachmentSlots: 6 })
});

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

function getLoadoutWriteFlags(applied = false) {
  return {
    loadoutWritten: applied,
    attachmentWritten: applied,
    saveWritten: applied,
    inventoryWritten: false,
    creditsWritten: false,
    shipWritten: false,
    weaponWritten: false,
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
    cargo_pod_not_owned: "No owned Cargo Pod is available to equip.",
    ship_loadouts_path_missing_or_invalid: "Saved ship loadouts path is missing or invalid.",
    current_ship_loadout_missing_or_invalid: "Current ship loadout path is missing or invalid.",
    attachment_slots_full: "No empty attachment slot.",
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

function isCargoPodItem(itemId) {
  return getString(itemId) === CARGO_POD_ITEM_ID;
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

function getCargoCapacity(saveData, shipId, attachments = []) {
  const ship = STAGING_SHIP_CONFIG[shipId];
  if (!ship) return null;
  return ship.cargo + getCargoPodCount(attachments) * CARGO_POD_CARGO_BONUS;
}

export function getLoadoutWriteEnvGate(playerId, itemId = CARGO_POD_ITEM_ID, env = process.env) {
  const scope = getString(env.STAGING_LOADOUT_WRITE_SCOPE, "disabled").toLowerCase();
  const normalizedScope = scope === "verified" || scope === "allowlist" ? scope : "disabled";
  const allowlist = getCsvSet(env.STAGING_LOADOUT_WRITE_ALLOWLIST);
  const allowedItems = getCsvSet(env.STAGING_LOADOUT_WRITE_ALLOWED_ITEMS || CARGO_POD_ITEM_ID);
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

export async function applyStagingCargoPodEquipWrite({
  playerId = "",
  itemId = CARGO_POD_ITEM_ID,
  trustedState = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const safePlayerId = getString(playerId);
  if (!safePlayerId) return blocked("verified_identity_required", { itemId });
  if (!isCargoPodItem(itemId)) return blocked("unknown_loadout_item", { itemId });
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
    const plan = buildStagingCargoPodEquipPlan(saveData, { itemId });
    if (!plan.ok) return { ...plan, envGate, itemId };
    const patchResult = await patchPlayerSaveData(baseUrl, safePlayerId, plan.patchedSaveData, config, fetchImpl);
    if (!patchResult.ok) return blocked(patchResult.reason, { envGate, status: patchResult.status, itemId });

    return {
      ok: true,
      mode: "loadout_write",
      operation: "equip",
      applied: true,
      dryRun: false,
      reason: "Cargo Pod equipped",
      debugReason: "phase3_staging_cargo_pod_equip_applied",
      itemId: CARGO_POD_ITEM_ID,
      name: "Cargo Pod",
      category: "equipment",
      currentShipId: plan.currentShipId,
      ownedBefore: plan.ownedBefore,
      ownedAfter: plan.ownedAfter,
      equippedBefore: plan.equippedBefore,
      equippedAfter: plan.equippedAfter,
      cargoCapacityBefore: plan.cargoCapacityBefore,
      cargoCapacityAfterPreview: plan.cargoCapacityAfterPreview,
      cargoCapacityAfter: plan.cargoCapacityAfter,
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
      writes: getLoadoutWriteFlags(true),
      ...getLoadoutWriteFlags(true),
      appliedFields: plan.appliedFields
    };
  } catch (_err) {
    return blocked("staging_loadout_write_failed", { itemId, status: 0 });
  }
}

export const LoadoutWriteService = Object.freeze({
  getLoadoutWriteEnvGate,
  buildStagingCargoPodEquipPlan,
  applyStagingCargoPodEquipWrite
});
