/* Staging-only server-authoritative trade write prototype.
   This service is deliberately narrow: it can patch verified player_saves for
   allowlisted buy/sell operations only after the room/config gates pass. It
   never writes inventory, loot, bounties, PvP/player damage, or broad
   progression fields. */

const PLAYER_SAVES_TABLE = "player_saves";
const MAX_CREDITS = 999999999;
const MAX_CARGO = 999999;

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

function normalizeCargoResourceKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getOfferResourceKeys(offer = {}) {
  return [
    getString(offer.resourceName),
    getString(offer.resourceId)
  ].filter(Boolean);
}

function findCargoResourceKey(container = {}, offer = {}) {
  if (!container || typeof container !== "object" || Array.isArray(container)) return "";
  const directKey = getOfferResourceKeys(offer).find((key) => Object.prototype.hasOwnProperty.call(container, key));
  if (directKey) return directKey;

  const normalizedOfferKeys = new Set(getOfferResourceKeys(offer).map(normalizeCargoResourceKey));
  return Object.keys(container).find((key) => normalizedOfferKeys.has(normalizeCargoResourceKey(key))) || "";
}

function getCargoResourceAmount(container = {}, offer = {}, max = MAX_CARGO) {
  const key = findCargoResourceKey(container, offer);
  if (!key) return { key: getString(offer.resourceName), amount: 0, found: false };
  const amount = clampInteger(container[key], 0, max);
  return { key, amount: amount || 0, found: amount !== null };
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getString(env.SUPABASE_URL),
    serviceRoleKey: getString(env.SUPABASE_SERVICE_ROLE_KEY)
  };
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

function normalizeStagingWriteScope(value, fallback = "disabled") {
  const requestedScope = getString(value, fallback).toLowerCase();
  const supported = requestedScope === "all" || requestedScope === "verified" || requestedScope === "allowlist" || requestedScope === "disabled";
  return {
    requestedScope,
    scope: supported ? requestedScope : "invalid",
    scopeInvalid: !supported
  };
}

function getTradeWriteEnvGate(playerId, env = process.env) {
  const scopeGate = normalizeStagingWriteScope(env.STAGING_TRADE_WRITE_SCOPE, "disabled");
  const allowlist = getCsvSet(env.STAGING_TRADE_WRITE_ALLOWLIST);
  const normalizedScope = scopeGate.scope;
  const playerAllowed = normalizedScope === "all" || normalizedScope === "verified"
    ? !!playerId
    : normalizedScope === "allowlist" && !!playerId && allowlist.has(playerId);

  return {
    writeEnabled: getBooleanEnv(env.STAGING_TRADE_WRITE_ENABLED, false),
    dryRun: getBooleanEnv(env.STAGING_TRADE_WRITE_DRY_RUN, true),
    scope: normalizedScope,
    requestedScope: scopeGate.requestedScope,
    scopeInvalid: scopeGate.scopeInvalid,
    allowlistPresent: allowlist.size > 0,
    playerAllowed
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

function getTradeWriteFlags(applied = false) {
  return {
    creditsWritten: applied,
    cargoWritten: applied,
    saveWritten: applied,
    inventoryWritten: false,
    lootWritten: false,
    bountyWritten: false
  };
}

function getBlockedResult(reason, extra = {}) {
  const operation = extra.operation || "buy";
  return {
    ok: false,
    mode: "blocked",
    operation,
    applied: false,
    dryRun: true,
    reason,
    debugReason: reason,
    userReason: getTradeWriteUserReason(reason),
    writes: getTradeWriteFlags(false),
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    inventoryWritten: false,
    lootWritten: false,
    bountyWritten: false,
    ...extra,
    operation
  };
}

function getTradeWriteUserReason(reason = "") {
  const labels = {
    verified_player_required: "Verified Supabase identity is required for staging trade writes.",
    unknown_trade_offer: "This staging trade offer is not available.",
    trusted_save_required: "Trusted player_saves read is required before writing trade changes.",
    fetch_unavailable: "Server fetch is unavailable for the trade write.",
    staging_trade_writes_disabled: "Staging trade writes are disabled on the server.",
    staging_trade_dry_run_enabled: "Staging trade dry-run is enabled on the server.",
    staging_trade_write_scope_disabled: "Staging trade write scope is disabled.",
    staging_trade_write_scope_invalid: "Staging trade write scope is invalid.",
    staging_trade_write_allowlist_missing: "Staging trade write allowlist is missing.",
    player_not_in_staging_trade_write_allowlist: "This verified player is not allowlisted for staging trade writes.",
    supabase_config_missing: "Supabase service-role configuration is missing or invalid.",
    player_save_read_failed: "Trusted player_saves read failed.",
    player_save_missing: "No matching player_saves row was found.",
    player_save_patch_failed: "player_saves patch failed.",
    save_data_missing_or_invalid: "Saved game data is missing or invalid.",
    credits_path_missing_or_invalid: "Saved credits path is missing or invalid.",
    cargo_path_missing_or_invalid: "Saved cargo path is missing or invalid.",
    cargo_cost_basis_path_missing_or_invalid: "Saved cargo cost-basis path is missing or invalid.",
    trusted_cargo_capacity_required: "Trusted cargo capacity is required before writing trade changes.",
    trade_offer_invalid: "The staging trade offer payload is invalid.",
    insufficient_credits: "Blocked: not enough credits.",
    insufficient_cargo: "Blocked: not enough cargo space.",
    insufficient_resource_cargo: "Blocked: not enough saved cargo to sell.",
    staging_trade_write_failed: "Staging trade write failed safely."
  };
  return labels[reason] || `Blocked: ${reason || "staging trade write unavailable"}.`;
}

function getCargoUsed(cargo = {}) {
  return Object.values(cargo).reduce((total, value) => {
    const amount = clampInteger(value, 0, MAX_CARGO);
    return total + (amount || 0);
  }, 0);
}

function readCargoLedgerAmount(saveData = {}, ledgerName = "", offer = {}, totalHeld = 0, fallback = 0) {
  const ledger = saveData?.[ledgerName];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) return Math.max(0, Math.min(totalHeld, fallback));
  const ledgerEntry = getCargoResourceAmount(ledger, offer);
  const amount = ledgerEntry.found ? ledgerEntry.amount : fallback;
  return Math.max(0, Math.min(totalHeld, amount));
}

function ensureCargoLedger(saveData = {}, ledgerName = "") {
  if (!saveData[ledgerName] || typeof saveData[ledgerName] !== "object" || Array.isArray(saveData[ledgerName])) {
    saveData[ledgerName] = {};
  }
  return saveData[ledgerName];
}

export function buildStagingTradeBuySavePatch(saveData = {}, offer = {}, quantity = 1, context = {}) {
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return getBlockedResult("save_data_missing_or_invalid");
  }

  const safeQuantity = clampInteger(quantity, 1, MAX_CARGO);
  const buyPrice = clampInteger(offer.buyPrice, 0, MAX_CREDITS);
  const resourceName = getString(offer.resourceName);
  const resourceId = getString(offer.resourceId);
  const offerId = getString(offer.offerId);
  if (!safeQuantity || !resourceName || !offerId || buyPrice === null || buyPrice <= 0) {
    return getBlockedResult("trade_offer_invalid");
  }

  const creditsBefore = clampInteger(saveData.credits, 0, MAX_CREDITS);
  const cargo = saveData.cargo;
  const cargoCostBasis = saveData.cargoCostBasis;
  if (creditsBefore === null) return getBlockedResult("credits_path_missing_or_invalid");
  if (!cargo || typeof cargo !== "object" || Array.isArray(cargo)) return getBlockedResult("cargo_path_missing_or_invalid");
  if (!cargoCostBasis || typeof cargoCostBasis !== "object" || Array.isArray(cargoCostBasis)) {
    return getBlockedResult("cargo_cost_basis_path_missing_or_invalid");
  }

  const cargoCapacity = clampInteger(context.cargoCapacity, 0, MAX_CARGO);
  if (cargoCapacity === null) return getBlockedResult("trusted_cargo_capacity_required");

  const resourceKey = findCargoResourceKey(cargo, offer) || resourceName;
  const resourceBefore = clampInteger(cargo[resourceKey], 0, MAX_CARGO) || 0;
  const cargoUsedBefore = getCargoUsed(cargo);
  const cargoFree = Math.max(0, cargoCapacity - Math.min(cargoUsedBefore, cargoCapacity));
  const cost = buyPrice * safeQuantity;
  if (creditsBefore < cost) return getBlockedResult("insufficient_credits");
  if (safeQuantity > cargoFree) return getBlockedResult("insufficient_cargo");

  const basisKey = findCargoResourceKey(cargoCostBasis, offer) || resourceKey;
  const previousBasis = clampInteger(cargoCostBasis[basisKey], 0, MAX_CREDITS) || buyPrice;
  const recoveredBefore = readCargoLedgerAmount(saveData, "cargoRecovered", offer, resourceBefore, 0);
  const purchasedBefore = readCargoLedgerAmount(saveData, "cargoPurchased", offer, resourceBefore, Math.max(0, resourceBefore - recoveredBefore));
  const resourceAfter = resourceBefore + safeQuantity;
  const purchasedAfter = purchasedBefore + safeQuantity;
  const weightedBasis = Math.round(((purchasedBefore * previousBasis) + (safeQuantity * buyPrice)) / Math.max(1, purchasedAfter));
  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.credits = creditsBefore - cost;
  patchedSaveData.cargo[resourceKey] = resourceAfter;
  patchedSaveData.cargoCostBasis[basisKey] = weightedBasis;
  const purchasedLedger = ensureCargoLedger(patchedSaveData, "cargoPurchased");
  const recoveredLedger = ensureCargoLedger(patchedSaveData, "cargoRecovered");
  const purchasedKey = findCargoResourceKey(purchasedLedger, offer) || resourceKey;
  const recoveredKey = findCargoResourceKey(recoveredLedger, offer) || resourceKey;
  purchasedLedger[purchasedKey] = purchasedAfter;
  if (recoveredBefore > 0) recoveredLedger[recoveredKey] = recoveredBefore;
  else delete recoveredLedger[recoveredKey];

  return {
    ok: true,
    mode: "trade_write_plan",
    operation: "buy",
    applied: false,
    dryRun: true,
    offerId,
    resourceId,
    resourceName,
    resourceKey,
    quantity: safeQuantity,
    cost,
    creditsDelta: -cost,
    cargoDelta: safeQuantity,
    creditsBefore,
    creditsAfter: patchedSaveData.credits,
    cargoBefore: resourceBefore,
    cargoAfter: resourceAfter,
    cargoUsedBefore,
    cargoUsedAfter: cargoUsedBefore + safeQuantity,
    cargoCapacity,
    cargoCostBasisBefore: previousBasis,
    cargoCostBasisAfter: weightedBasis,
    purchasedCargoBefore: purchasedBefore,
    purchasedCargoAfter: purchasedAfter,
    recoveredCargoBefore: recoveredBefore,
    recoveredCargoAfter: recoveredBefore,
    patchedSaveData,
    appliedFields: ["credits", "cargo", "cargoCostBasis", "cargoPurchased", "cargoRecovered"],
    untouchedFields: ["inventory", "loot", "bounties", "PvP", "playerDamage", "progression"]
  };
}

export function buildStagingTradeSellSavePatch(saveData = {}, offer = {}, quantity = 1, context = {}) {
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return getBlockedResult("save_data_missing_or_invalid", { operation: "sell" });
  }

  const safeQuantity = clampInteger(quantity, 1, MAX_CARGO);
  const sellPrice = clampInteger(offer.sellPrice, 0, MAX_CREDITS);
  const resourceName = getString(offer.resourceName);
  const resourceId = getString(offer.resourceId);
  const offerId = getString(offer.offerId);
  if (!safeQuantity || !resourceName || !offerId || sellPrice === null || sellPrice <= 0) {
    return getBlockedResult("trade_offer_invalid", { operation: "sell" });
  }

  const creditsBefore = clampInteger(saveData.credits, 0, MAX_CREDITS);
  const cargo = saveData.cargo;
  const cargoCostBasis = saveData.cargoCostBasis;
  if (creditsBefore === null) return getBlockedResult("credits_path_missing_or_invalid", { operation: "sell" });
  if (!cargo || typeof cargo !== "object" || Array.isArray(cargo)) return getBlockedResult("cargo_path_missing_or_invalid", { operation: "sell" });
  if (!cargoCostBasis || typeof cargoCostBasis !== "object" || Array.isArray(cargoCostBasis)) {
    return getBlockedResult("cargo_cost_basis_path_missing_or_invalid", { operation: "sell" });
  }

  const cargoCapacity = clampInteger(context.cargoCapacity, 0, MAX_CARGO);
  if (cargoCapacity === null) return getBlockedResult("trusted_cargo_capacity_required", { operation: "sell" });

  const { key: resourceKey, amount: resourceBefore, found: resourceFound } = getCargoResourceAmount(cargo, offer);
  if (!resourceFound || resourceBefore < safeQuantity) {
    return getBlockedResult("insufficient_resource_cargo", {
      operation: "sell",
      resourceKey,
      expectedResourceKeys: getOfferResourceKeys(offer)
    });
  }

  const cargoUsedBefore = getCargoUsed(cargo);
  const basisKey = findCargoResourceKey(cargoCostBasis, offer) || resourceKey;
  const basisBefore = clampInteger(cargoCostBasis[basisKey], 0, MAX_CREDITS);
  const hasCostBasis = basisBefore !== null;
  const recoveredBefore = readCargoLedgerAmount(saveData, "cargoRecovered", offer, resourceBefore, hasCostBasis ? 0 : resourceBefore);
  const purchasedBefore = readCargoLedgerAmount(saveData, "cargoPurchased", offer, resourceBefore, Math.max(0, resourceBefore - recoveredBefore));
  const purchasedQuantitySold = Math.min(safeQuantity, purchasedBefore);
  const recoveredQuantitySold = Math.min(safeQuantity - purchasedQuantitySold, recoveredBefore);

  const revenue = sellPrice * safeQuantity;
  const resourceAfter = Math.max(0, resourceBefore - safeQuantity);
  const patchedSaveData = cloneJson(saveData);
  patchedSaveData.credits = Math.min(MAX_CREDITS, creditsBefore + revenue);
  patchedSaveData.cargo[resourceKey] = resourceAfter;
  const purchasedAfter = Math.max(0, purchasedBefore - purchasedQuantitySold);
  const recoveredAfter = Math.max(0, recoveredBefore - recoveredQuantitySold);
  const purchasedLedger = ensureCargoLedger(patchedSaveData, "cargoPurchased");
  const recoveredLedger = ensureCargoLedger(patchedSaveData, "cargoRecovered");
  const purchasedKey = findCargoResourceKey(purchasedLedger, offer) || resourceKey;
  const recoveredKey = findCargoResourceKey(recoveredLedger, offer) || resourceKey;
  if (purchasedAfter > 0) purchasedLedger[purchasedKey] = purchasedAfter;
  else delete purchasedLedger[purchasedKey];
  if (recoveredAfter > 0) recoveredLedger[recoveredKey] = recoveredAfter;
  else delete recoveredLedger[recoveredKey];
  if (purchasedAfter <= 0) {
    delete patchedSaveData.cargoCostBasis[basisKey];
  } else if (hasCostBasis) {
    // cargoCostBasis is an average unit basis in the local save. A partial
    // sale leaves the remaining cargo's unit basis unchanged.
    patchedSaveData.cargoCostBasis[basisKey] = basisBefore;
  }

  return {
    ok: true,
    mode: "trade_write_plan",
    operation: "sell",
    applied: false,
    dryRun: true,
    offerId,
    resourceId,
    resourceName,
    resourceKey,
    quantity: safeQuantity,
    revenue,
    creditsDelta: revenue,
    cargoDelta: -safeQuantity,
    creditsBefore,
    creditsAfter: patchedSaveData.credits,
    cargoBefore: resourceBefore,
    cargoAfter: resourceAfter,
    cargoUsedBefore,
    cargoUsedAfter: Math.max(0, cargoUsedBefore - safeQuantity),
    cargoCapacity,
    cargoCostBasisBefore: hasCostBasis ? basisBefore : null,
    cargoCostBasisAfter: hasCostBasis && purchasedAfter > 0 ? basisBefore : null,
    purchasedQuantitySold,
    recoveredQuantitySold,
    purchasedCargoBefore: purchasedBefore,
    purchasedCargoAfter: purchasedAfter,
    recoveredCargoBefore: recoveredBefore,
    recoveredCargoAfter: recoveredAfter,
    recoveredResourceSale: recoveredQuantitySold > 0 && purchasedQuantitySold === 0,
    patchedSaveData,
    appliedFields: ["credits", "cargo", "cargoCostBasis", "cargoPurchased", "cargoRecovered"],
    untouchedFields: ["inventory", "loot", "bounties", "PvP", "playerDamage", "progression", "tradeTotals"]
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

export async function applyStagingTradeBuyWrite({
  playerId = "",
  offer = null,
  quantity = 1,
  trustedState = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const safePlayerId = getString(playerId);
  if (!safePlayerId) return getBlockedResult("verified_player_required");
  if (!offer) return getBlockedResult("unknown_trade_offer");
  if (!trustedState?.available || !trustedState?.validationState) {
    return getBlockedResult("trusted_save_required");
  }
  if (typeof fetchImpl !== "function") return getBlockedResult("fetch_unavailable");

  const envGate = getTradeWriteEnvGate(safePlayerId, env);
  if (!envGate.writeEnabled) return getBlockedResult("staging_trade_writes_disabled", { envGate });
  if (envGate.dryRun) return getBlockedResult("staging_trade_dry_run_enabled", { envGate });
  if (!envGate.playerAllowed) {
    const blockReason = envGate.scopeInvalid
      ? "staging_trade_write_scope_invalid"
      : envGate.scope === "disabled"
        ? "staging_trade_write_scope_disabled"
        : envGate.scope === "allowlist" && !envGate.allowlistPresent
          ? "staging_trade_write_allowlist_missing"
          : "player_not_in_staging_trade_write_allowlist";
    return getBlockedResult(blockReason, { envGate });
  }

  const config = getSupabaseConfig(env);
  const baseUrl = getValidSupabaseUrl(config.url);
  if (!baseUrl || !config.serviceRoleKey) return getBlockedResult("supabase_config_missing");

  try {
    const readResult = await fetchPlayerSaveRow(baseUrl, safePlayerId, config, fetchImpl);
    if (!readResult.ok) {
      return getBlockedResult(readResult.reason, { status: readResult.status });
    }

    const saveData = getSaveDataFromRow(readResult.row);
    const patchPlan = buildStagingTradeBuySavePatch(saveData, offer, quantity, {
      cargoCapacity: trustedState.validationState.cargoCapacity
    });
    if (!patchPlan.ok) {
      return {
        ...patchPlan,
        offerId: offer.offerId || "",
        resourceId: offer.resourceId || "",
        resourceName: offer.resourceName || "",
        quantity: Number(quantity) || 0
      };
    }

    const patchResult = await patchPlayerSaveData(baseUrl, safePlayerId, patchPlan.patchedSaveData, config, fetchImpl);
    if (!patchResult.ok) {
      return getBlockedResult(patchResult.reason, {
        status: patchResult.status,
        offerId: offer.offerId,
        resourceId: offer.resourceId,
        resourceName: offer.resourceName,
        quantity: patchPlan.quantity
      });
    }

    return {
      ok: true,
      mode: "trade_write",
      operation: "buy",
      applied: true,
      dryRun: false,
      reason: "Staging trade buy applied",
      debugReason: "phase5b_staging_trade_buy_write_applied",
      envGate,
      offerId: offer.offerId,
      resourceId: offer.resourceId,
      resourceName: offer.resourceName,
      quantity: patchPlan.quantity,
      cost: patchPlan.cost,
      creditsDelta: patchPlan.creditsDelta,
      cargoDelta: patchPlan.cargoDelta,
      creditsBefore: patchPlan.creditsBefore,
      creditsAfter: patchPlan.creditsAfter,
      cargoBefore: patchPlan.cargoBefore,
      cargoAfter: patchPlan.cargoAfter,
      cargoUsedBefore: patchPlan.cargoUsedBefore,
      cargoUsedAfter: patchPlan.cargoUsedAfter,
      cargoCapacity: patchPlan.cargoCapacity,
      cargoCostBasisBefore: patchPlan.cargoCostBasisBefore,
      cargoCostBasisAfter: patchPlan.cargoCostBasisAfter,
      recoveredResourceSale: patchPlan.recoveredResourceSale === true,
      status: patchResult.status,
      appliedFields: patchPlan.appliedFields,
      writes: getTradeWriteFlags(true),
      creditsWritten: true,
      cargoWritten: true,
      saveWritten: true,
      inventoryWritten: false,
      lootWritten: false,
      bountyWritten: false
    };
  } catch (_err) {
    return getBlockedResult("staging_trade_write_failed", {
      status: 0
    });
  }
}

export async function applyStagingTradeSellWrite({
  playerId = "",
  offer = null,
  quantity = 1,
  trustedState = null,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const safePlayerId = getString(playerId);
  if (!safePlayerId) return getBlockedResult("verified_player_required", { operation: "sell" });
  if (!offer) return getBlockedResult("unknown_trade_offer", { operation: "sell" });
  if (!trustedState?.available || !trustedState?.validationState) {
    return getBlockedResult("trusted_save_required", { operation: "sell" });
  }
  if (typeof fetchImpl !== "function") return getBlockedResult("fetch_unavailable", { operation: "sell" });

  const envGate = getTradeWriteEnvGate(safePlayerId, env);
  if (!envGate.writeEnabled) return getBlockedResult("staging_trade_writes_disabled", { operation: "sell", envGate });
  if (envGate.dryRun) return getBlockedResult("staging_trade_dry_run_enabled", { operation: "sell", envGate });
  if (!envGate.playerAllowed) {
    const blockReason = envGate.scopeInvalid
      ? "staging_trade_write_scope_invalid"
      : envGate.scope === "disabled"
        ? "staging_trade_write_scope_disabled"
        : envGate.scope === "allowlist" && !envGate.allowlistPresent
          ? "staging_trade_write_allowlist_missing"
          : "player_not_in_staging_trade_write_allowlist";
    return getBlockedResult(blockReason, { operation: "sell", envGate });
  }

  const config = getSupabaseConfig(env);
  const baseUrl = getValidSupabaseUrl(config.url);
  if (!baseUrl || !config.serviceRoleKey) return getBlockedResult("supabase_config_missing", { operation: "sell" });

  try {
    const readResult = await fetchPlayerSaveRow(baseUrl, safePlayerId, config, fetchImpl);
    if (!readResult.ok) {
      return getBlockedResult(readResult.reason, { operation: "sell", status: readResult.status });
    }

    const saveData = getSaveDataFromRow(readResult.row);
    const patchPlan = buildStagingTradeSellSavePatch(saveData, offer, quantity, {
      cargoCapacity: trustedState.validationState.cargoCapacity
    });
    if (!patchPlan.ok) {
      return {
        ...patchPlan,
        offerId: offer.offerId || "",
        resourceId: offer.resourceId || "",
        resourceName: offer.resourceName || "",
        quantity: Number(quantity) || 0
      };
    }

    const patchResult = await patchPlayerSaveData(baseUrl, safePlayerId, patchPlan.patchedSaveData, config, fetchImpl);
    if (!patchResult.ok) {
      return getBlockedResult(patchResult.reason, {
        operation: "sell",
        status: patchResult.status,
        offerId: offer.offerId,
        resourceId: offer.resourceId,
        resourceName: offer.resourceName,
        quantity: patchPlan.quantity
      });
    }

    return {
      ok: true,
      mode: "trade_write",
      operation: "sell",
      applied: true,
      dryRun: false,
      reason: "Staging trade sell applied",
      debugReason: "phase5d_staging_trade_sell_write_applied",
      envGate,
      offerId: offer.offerId,
      resourceId: offer.resourceId,
      resourceName: offer.resourceName,
      quantity: patchPlan.quantity,
      revenue: patchPlan.revenue,
      creditsDelta: patchPlan.creditsDelta,
      cargoDelta: patchPlan.cargoDelta,
      creditsBefore: patchPlan.creditsBefore,
      creditsAfter: patchPlan.creditsAfter,
      cargoBefore: patchPlan.cargoBefore,
      cargoAfter: patchPlan.cargoAfter,
      cargoUsedBefore: patchPlan.cargoUsedBefore,
      cargoUsedAfter: patchPlan.cargoUsedAfter,
      cargoCapacity: patchPlan.cargoCapacity,
      cargoCostBasisBefore: patchPlan.cargoCostBasisBefore,
      cargoCostBasisAfter: patchPlan.cargoCostBasisAfter,
      status: patchResult.status,
      appliedFields: patchPlan.appliedFields,
      writes: getTradeWriteFlags(true),
      creditsWritten: true,
      cargoWritten: true,
      saveWritten: true,
      inventoryWritten: false,
      lootWritten: false,
      bountyWritten: false
    };
  } catch (_err) {
    return getBlockedResult("staging_trade_write_failed", {
      operation: "sell",
      status: 0
    });
  }
}

export const TradeWriteService = Object.freeze({
  buildStagingTradeBuySavePatch,
  buildStagingTradeSellSavePatch,
  applyStagingTradeBuyWrite,
  applyStagingTradeSellWrite
});
