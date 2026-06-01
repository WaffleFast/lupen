/* Staging-only Store write prototype.
   This service is intentionally tiny: it can patch only attachment:cargoPod,
   attachment:shieldBooster, and gun:pulseLaser ownership after strict staging gates pass. It never
   writes ships, loadouts, loot, bounties, PvP/player damage, broad progression,
   or schemas. */

import { getStagingStoreItemById } from "../config/stagingStoreConfig.js";

const PLAYER_SAVES_TABLE = "player_saves";
const CARGO_POD_ITEM_ID = "attachment:cargoPod";
const CARGO_POD_KEY = "cargoPod";
const SHIELD_BOOSTER_ITEM_ID = "attachment:shieldBooster";
const SHIELD_BOOSTER_KEY = "shieldBooster";
const PULSE_LASER_ITEM_ID = "gun:pulseLaser";
const PULSE_LASER_KEY = "pulseLaser";
const MAX_CREDITS = 999999999;
const MAX_ATTACHMENT_COUNT = 9999;
const MAX_GUN_COUNT = 9999;

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

function normalizeStoreWriteQuantity(value) {
  const number = getFiniteNumber(value);
  if (number === null) return null;
  const integer = Math.floor(number);
  return integer === 1 ? 1 : null;
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
  const safePlayerId = encodeURIComponent(playerId);
  return `${baseUrl}/rest/v1/${PLAYER_SAVES_TABLE}?user_id=eq.${safePlayerId}`;
}

function getPlayerSaveReadUrl(baseUrl, playerId) {
  return `${getPlayerSaveUrl(baseUrl, playerId)}&select=save_data,updated_at&limit=1`;
}

function getSaveDataFromRow(row = {}) {
  return row?.save_data && typeof row.save_data === "object" && !Array.isArray(row.save_data)
    ? row.save_data
    : null;
}

function isCargoPodItem(item) {
  return item?.itemId === CARGO_POD_ITEM_ID && item?.localKey === CARGO_POD_KEY;
}

function isShieldBoosterItem(item) {
  return item?.itemId === SHIELD_BOOSTER_ITEM_ID && item?.localKey === SHIELD_BOOSTER_KEY;
}

function isPulseLaserItem(item) {
  return item?.itemId === PULSE_LASER_ITEM_ID && item?.localKey === PULSE_LASER_KEY;
}

function getStoreWriteFlags(applied = false, writeKind = "") {
  return {
    creditsWritten: applied,
    inventoryWritten: false,
    attachmentWritten: applied && writeKind === "attachment",
    equipmentWritten: applied,
    shipWritten: false,
    weaponWritten: applied && writeKind === "weapon",
    saveWritten: applied,
    lootWritten: false,
    bountyWritten: false
  };
}

function getBlockedResult(reason, extra = {}) {
  return {
    ok: false,
    mode: "blocked",
    operation: "purchase",
    applied: false,
    dryRun: true,
    blockReason: reason,
    userReason: getStoreUserReason(reason),
    writes: getStoreWriteFlags(false),
    ...getStoreWriteFlags(false),
    ...extra
  };
}

function getStoreUserReason(reason) {
  const labels = {
    staging_store_writes_disabled: "Store writes are disabled in staging.",
    staging_store_dry_run_enabled: "Dry run only - no credits or Store ownership changed.",
    verified_identity_required: "Verified staging identity required.",
    staging_store_write_allowlist_missing: "Store write allowlist is missing.",
    player_not_in_staging_store_write_allowlist: "Player is not allowlisted for staging Store writes.",
    store_item_preview_only: "This item is preview-only in staging.",
    store_item_not_allowed: "This Store item is not enabled for staging writes.",
    invalid_store_quantity: "Only one staging Store item can be purchased per request.",
    trusted_save_required: "Trusted player save read required.",
    insufficient_credits: "Blocked: not enough credits.",
    credits_path_missing_or_invalid: "Saved credits path is missing or invalid.",
    owned_attachments_path_missing_or_invalid: "Saved attachment ownership path is missing or invalid.",
    cargo_pod_count_missing_or_invalid: "Saved Cargo Pod ownership count is missing or invalid.",
    shield_booster_count_missing_or_invalid: "Saved Shield Booster ownership count is missing or invalid.",
    owned_guns_path_missing_or_invalid: "Saved weapon ownership path is missing or invalid.",
    pulse_laser_count_missing_or_invalid: "Saved Pulse Laser ownership count is missing or invalid.",
    supabase_config_missing: "Supabase server config unavailable.",
    player_save_missing: "Player save not found.",
    player_save_read_failed: "Player save read failed.",
    player_save_patch_failed: "Player save patch failed."
  };
  return labels[reason] || `Blocked: ${reason || "Store write unavailable"}.`;
}

export function getStoreWriteEnvGate(playerId, itemId = CARGO_POD_ITEM_ID, env = process.env) {
  const scope = getString(env.STAGING_STORE_WRITE_SCOPE, "disabled").toLowerCase();
  const normalizedScope = scope === "verified" || scope === "allowlist" ? scope : "disabled";
  const allowlist = getCsvSet(env.STAGING_STORE_WRITE_ALLOWLIST);
  const allowedItems = getCsvSet(env.STAGING_STORE_WRITE_ALLOWED_ITEMS || CARGO_POD_ITEM_ID);
  const playerAllowed = normalizedScope === "verified"
    ? !!playerId
    : !!playerId && allowlist.has(playerId);

  return {
    writeEnabled: getBooleanEnv(env.STAGING_STORE_WRITE_ENABLED, false),
    dryRun: getBooleanEnv(env.STAGING_STORE_WRITE_DRY_RUN, true),
    scope: normalizedScope,
    allowlistPresent: allowlist.size > 0,
    allowlisted: playerAllowed,
    playerAllowed,
    itemAllowed: allowedItems.has(itemId),
    allowedItemCount: allowedItems.size,
    maxQuantity: clampInteger(env.STAGING_STORE_WRITE_MAX_QUANTITY || 1, 1, 1) || 1
  };
}

export function buildStagingStorePurchasePatch(saveData = {}, item = null, quantity = 1) {
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return getBlockedResult("save_data_missing_or_invalid");
  }

  const selectedItem = item || getStagingStoreItemById(CARGO_POD_ITEM_ID);
  const safeQuantity = normalizeStoreWriteQuantity(quantity);
  const writesAttachment = isCargoPodItem(selectedItem);
  const writesShieldBooster = isShieldBoosterItem(selectedItem);
  const writesWeapon = isPulseLaserItem(selectedItem);
  if (!selectedItem || (!writesAttachment && !writesShieldBooster && !writesWeapon)) {
    return getBlockedResult("store_item_preview_only", {
      itemId: selectedItem?.itemId || "",
      name: selectedItem?.name || ""
    });
  }
  if (safeQuantity !== 1) {
    return getBlockedResult("invalid_store_quantity", {
      itemId: selectedItem.itemId,
      name: selectedItem.name,
      quantity: 0
    });
  }

  const unitPrice = clampInteger(selectedItem.price, 1, MAX_CREDITS);
  const creditsBefore = clampInteger(saveData.credits, 0, MAX_CREDITS);
  if (unitPrice === null) return getBlockedResult("store_item_invalid");
  if (creditsBefore === null) return getBlockedResult("credits_path_missing_or_invalid");
  if (creditsBefore < unitPrice) {
    return getBlockedResult("insufficient_credits", {
      itemId: selectedItem.itemId,
      name: selectedItem.name,
      category: selectedItem.category,
      quantity: safeQuantity,
      unitPrice,
      totalCost: unitPrice,
      creditsBefore,
      creditsAfter: creditsBefore
    });
  }

  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.credits = creditsBefore - unitPrice;
  let itemBefore = null;
  let itemAfter = null;
  let appliedFields = ["credits"];
  const untouchedFields = ["inventoryItems", "shipLoadouts", "ships", "loot", "bounties", "PvP", "playerDamage", "progression"];

  if (writesAttachment || writesShieldBooster) {
    if (!saveData.ownedAttachments || typeof saveData.ownedAttachments !== "object" || Array.isArray(saveData.ownedAttachments)) {
      return getBlockedResult("owned_attachments_path_missing_or_invalid");
    }
    const attachmentKey = writesShieldBooster ? SHIELD_BOOSTER_KEY : CARGO_POD_KEY;
    itemBefore = clampInteger(saveData.ownedAttachments[attachmentKey], 0, MAX_ATTACHMENT_COUNT);
    if (itemBefore === null) return getBlockedResult(writesShieldBooster ? "shield_booster_count_missing_or_invalid" : "cargo_pod_count_missing_or_invalid");
    itemAfter = Math.min(MAX_ATTACHMENT_COUNT, itemBefore + safeQuantity);
    patchedSaveData.ownedAttachments[attachmentKey] = itemAfter;
    appliedFields.push(`ownedAttachments.${attachmentKey}`);
    untouchedFields.push("ownedGuns", "guns");
  } else {
    if (!saveData.ownedGuns || typeof saveData.ownedGuns !== "object" || Array.isArray(saveData.ownedGuns)) {
      return getBlockedResult("owned_guns_path_missing_or_invalid");
    }
    itemBefore = clampInteger(saveData.ownedGuns[PULSE_LASER_KEY], 0, MAX_GUN_COUNT);
    if (itemBefore === null) return getBlockedResult("pulse_laser_count_missing_or_invalid");
    itemAfter = Math.min(MAX_GUN_COUNT, itemBefore + safeQuantity);
    patchedSaveData.ownedGuns[PULSE_LASER_KEY] = itemAfter;
    appliedFields.push("ownedGuns.pulseLaser");
    untouchedFields.push("ownedAttachments", "attachments");
  }

  return {
    ok: true,
    mode: "store_write_plan",
    operation: "purchase",
    applied: false,
    dryRun: true,
    itemId: selectedItem.itemId,
    name: selectedItem.name,
    category: selectedItem.category,
    localKind: selectedItem.localKind,
    localKey: selectedItem.localKey,
    quantity: safeQuantity,
    unitPrice,
    totalCost: unitPrice,
    creditsBefore,
    creditsAfter: patchedSaveData.credits,
    itemBefore,
    itemAfter,
    patchedSaveData,
    appliedFields,
    untouchedFields,
    writes: getStoreWriteFlags(false, writesAttachment ? "attachment" : "weapon"),
    ...getStoreWriteFlags(false, writesAttachment ? "attachment" : "weapon")
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

  if (!response?.ok) {
    return {
      ok: false,
      reason: "player_save_read_failed",
      status: Number(response?.status || 0),
      row: null
    };
  }

  const rows = typeof response.json === "function" ? await response.json() : [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    return {
      ok: false,
      reason: "player_save_missing",
      status: Number(response.status || 200),
      row: null
    };
  }

  return {
    ok: true,
    reason: "",
    status: Number(response.status || 200),
    row
  };
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

  if (!response?.ok) {
    return {
      ok: false,
      reason: "player_save_patch_failed",
      status: Number(response?.status || 0)
    };
  }

  return {
    ok: true,
    reason: "",
    status: Number(response.status || 200)
  };
}

export async function applyStagingStorePurchaseWrite({
  playerId = "",
  itemId = "",
  quantity = 1,
  trustedState = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const safePlayerId = getString(playerId);
  const selectedItem = getStagingStoreItemById(itemId);
  const safeQuantity = normalizeStoreWriteQuantity(quantity);

  if (!safePlayerId) return getBlockedResult("verified_identity_required", { itemId, quantity: safeQuantity || 0 });
  if (!selectedItem) return getBlockedResult("unknown_store_item", { itemId, quantity: safeQuantity || 0 });
  if (!isCargoPodItem(selectedItem) && !isShieldBoosterItem(selectedItem) && !isPulseLaserItem(selectedItem)) {
    return getBlockedResult("store_item_preview_only", {
      itemId: selectedItem.itemId,
      name: selectedItem.name,
      category: selectedItem.category,
      quantity: safeQuantity || 0
    });
  }
  if (safeQuantity !== 1) return getBlockedResult("invalid_store_quantity", { itemId: selectedItem.itemId, quantity: 0 });
  if (!trustedState?.available || !trustedState?.validationState) {
    return getBlockedResult("trusted_save_required", { itemId: selectedItem.itemId, quantity: safeQuantity });
  }
  if (typeof fetchImpl !== "function") return getBlockedResult("fetch_unavailable", { itemId: selectedItem.itemId });

  const envGate = getStoreWriteEnvGate(safePlayerId, selectedItem.itemId, env);
  if (!envGate.writeEnabled) return getBlockedResult("staging_store_writes_disabled", { envGate, itemId: selectedItem.itemId, quantity: safeQuantity });
  if (envGate.dryRun) return getBlockedResult("staging_store_dry_run_enabled", { envGate, itemId: selectedItem.itemId, quantity: safeQuantity });
  if (!envGate.itemAllowed) return getBlockedResult("store_item_not_allowed", { envGate, itemId: selectedItem.itemId, quantity: safeQuantity });
  if (!envGate.playerAllowed) {
    return getBlockedResult(envGate.scope === "allowlist" && !envGate.allowlistPresent
      ? "staging_store_write_allowlist_missing"
      : "player_not_in_staging_store_write_allowlist", { envGate, itemId: selectedItem.itemId, quantity: safeQuantity });
  }

  const config = getSupabaseConfig(env);
  const baseUrl = getValidSupabaseUrl(config.url);
  if (!baseUrl || !config.serviceRoleKey) return getBlockedResult("supabase_config_missing", { envGate, itemId: selectedItem.itemId });

  try {
    const readResult = await fetchPlayerSaveRow(baseUrl, safePlayerId, config, fetchImpl);
    if (!readResult.ok) {
      return getBlockedResult(readResult.reason, {
        envGate,
        status: readResult.status,
        itemId: selectedItem.itemId,
        name: selectedItem.name,
        quantity: safeQuantity
      });
    }

    const saveData = getSaveDataFromRow(readResult.row);
    const patchPlan = buildStagingStorePurchasePatch(saveData, selectedItem, safeQuantity);
    if (!patchPlan.ok) {
      return {
        ...patchPlan,
        envGate,
        itemId: selectedItem.itemId,
        name: selectedItem.name,
        category: selectedItem.category,
        quantity: safeQuantity
      };
    }

    const patchResult = await patchPlayerSaveData(baseUrl, safePlayerId, patchPlan.patchedSaveData, config, fetchImpl);
    if (!patchResult.ok) {
      return getBlockedResult(patchResult.reason, {
        envGate,
        status: patchResult.status,
        itemId: selectedItem.itemId,
        name: selectedItem.name,
        category: selectedItem.category,
        quantity: safeQuantity
      });
    }

    return {
      ok: true,
      mode: "store_write",
      operation: "purchase",
      applied: true,
      dryRun: false,
      reason: "Staging Store purchase applied",
      debugReason: isPulseLaserItem(selectedItem)
        ? "phase_weapon_staging_pulse_laser_purchase_applied"
        : isShieldBoosterItem(selectedItem)
          ? "phase_shield_booster_staging_purchase_applied"
        : "phase2_staging_store_cargo_pod_write_applied",
      itemId: selectedItem.itemId,
      name: selectedItem.name,
      category: selectedItem.category,
      localKind: selectedItem.localKind,
      localKey: selectedItem.localKey,
      quantity: patchPlan.quantity,
      unitPrice: patchPlan.unitPrice,
      totalCost: patchPlan.totalCost,
      creditsBefore: patchPlan.creditsBefore,
      creditsAfter: patchPlan.creditsAfter,
      itemBefore: patchPlan.itemBefore,
      itemAfter: patchPlan.itemAfter,
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
      writes: getStoreWriteFlags(true, isPulseLaserItem(selectedItem) ? "weapon" : "attachment"),
      ...getStoreWriteFlags(true, isPulseLaserItem(selectedItem) ? "weapon" : "attachment"),
      appliedFields: patchPlan.appliedFields
    };
  } catch (_err) {
    return getBlockedResult("staging_store_write_failed", {
      itemId: selectedItem.itemId,
      name: selectedItem.name,
      quantity: safeQuantity,
      status: 0
    });
  }
}

export const StoreWriteService = Object.freeze({
  getStoreWriteEnvGate,
  buildStagingStorePurchasePatch,
  applyStagingStorePurchaseWrite
});
