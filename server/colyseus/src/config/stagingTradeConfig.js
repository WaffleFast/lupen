/* Static staging trade preview config.
   This is intentionally deterministic server-side data for multiplayer trade.
   The offer list is derived from one Map 1 price table so every planet can buy
   and sell the current staging resources without finite route stock. */

export const STAGING_TRADE_RESOURCES = Object.freeze([
  Object.freeze({ resourceId: "iron", resourceName: "Iron" }),
  Object.freeze({ resourceId: "copper", resourceName: "Copper" }),
  Object.freeze({ resourceId: "cobalt", resourceName: "Cobalt" }),
  Object.freeze({ resourceId: "crystal_shards", resourceName: "Crystal Shards" })
]);

export const STAGING_TRADE_PRICE_TABLE = Object.freeze({
  "Asteron Prime": Object.freeze({
    Iron: 18,
    Copper: 38,
    Cobalt: 90,
    "Crystal Shards": 95
  }),
  Virella: Object.freeze({
    Iron: 30,
    Copper: 32,
    Cobalt: 74,
    "Crystal Shards": 120
  }),
  Nyxara: Object.freeze({
    Iron: 24,
    Copper: 50,
    Cobalt: 62,
    "Crystal Shards": 145
  })
});

const STAGING_TRADE_PLANETS = Object.freeze(Object.keys(STAGING_TRADE_PRICE_TABLE));
const STAGING_TRADE_PLANET_SLUGS = Object.freeze({
  "Asteron Prime": "asteron",
  Virella: "virella",
  Nyxara: "nyxara"
});
const STAGING_TRADE_RESOURCE_SLUGS = Object.freeze({
  crystal_shards: "crystal"
});

function getStagingTradeOfferId(resourceId = "", buyNode = "", sellNode = "") {
  return [
    "staging",
    STAGING_TRADE_RESOURCE_SLUGS[resourceId] || String(resourceId || "").replace(/_/g, "-"),
    STAGING_TRADE_PLANET_SLUGS[buyNode] || String(buyNode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    STAGING_TRADE_PLANET_SLUGS[sellNode] || String(sellNode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  ].filter(Boolean).join("-");
}

function buildStagingTradeOffers() {
  return STAGING_TRADE_RESOURCES.flatMap((resource) => {
    return STAGING_TRADE_PLANETS.flatMap((buyNode) => {
      return STAGING_TRADE_PLANETS
        .filter((sellNode) => sellNode !== buyNode)
        .map((sellNode) => Object.freeze({
          offerId: getStagingTradeOfferId(resource.resourceId, buyNode, sellNode),
          resourceId: resource.resourceId,
          resourceName: resource.resourceName,
          buyNode,
          sellNode,
          buyPrice: STAGING_TRADE_PRICE_TABLE[buyNode][resource.resourceName],
          sellPrice: STAGING_TRADE_PRICE_TABLE[sellNode][resource.resourceName],
          maxQuantity: 1000,
          refreshSeconds: 300
        }));
    });
  });
}

export const STAGING_TRADE_OFFERS = Object.freeze(buildStagingTradeOffers());

export function getStagingTradeOffers() {
  return STAGING_TRADE_OFFERS.map((offer) => ({ ...offer }));
}

export function getStagingTradeOfferById(offerId = "") {
  const safeOfferId = String(offerId || "").trim();
  const offer = STAGING_TRADE_OFFERS.find((entry) => entry.offerId === safeOfferId);
  return offer ? { ...offer } : null;
}

function getFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTradeNumber(value, max = 999999999) {
  const number = getFiniteNumber(value);
  if (number === null) return null;
  return Math.max(0, Math.min(max, Math.floor(number)));
}

function normalizeTradeResourceKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getOfferResourceKeys(offer = {}) {
  return [
    String(offer?.resourceName || "").trim(),
    String(offer?.resourceId || "").trim()
  ].filter(Boolean);
}

function readResourceAmount(resourceMap = {}, offer = {}) {
  if (!resourceMap || typeof resourceMap !== "object" || Array.isArray(resourceMap)) return null;
  const directKey = getOfferResourceKeys(offer).find((key) => Object.prototype.hasOwnProperty.call(resourceMap, key));
  if (directKey) return normalizeTradeNumber(resourceMap[directKey], 999999);

  const normalizedOfferKeys = new Set(getOfferResourceKeys(offer).map(normalizeTradeResourceKey));
  const compatibleKey = Object.keys(resourceMap).find((key) => normalizedOfferKeys.has(normalizeTradeResourceKey(key)));
  return compatibleKey ? normalizeTradeNumber(resourceMap[compatibleKey], 999999) : null;
}

function readResourceDebug(resourceMap = {}, offer = {}, max = 999999) {
  if (!resourceMap || typeof resourceMap !== "object" || Array.isArray(resourceMap)) {
    return { found: false, key: "", amount: null };
  }

  const directKey = getOfferResourceKeys(offer).find((key) => Object.prototype.hasOwnProperty.call(resourceMap, key));
  if (directKey) {
    return {
      found: true,
      key: directKey,
      amount: normalizeTradeNumber(resourceMap[directKey], max)
    };
  }

  const normalizedOfferKeys = new Set(getOfferResourceKeys(offer).map(normalizeTradeResourceKey));
  const compatibleKey = Object.keys(resourceMap).find((key) => normalizedOfferKeys.has(normalizeTradeResourceKey(key)));
  return compatibleKey
    ? { found: true, key: compatibleKey, amount: normalizeTradeNumber(resourceMap[compatibleKey], max) }
    : { found: false, key: "", amount: null };
}

function getUnknownValidation(reason = "unknown_player_state", readStatus = "") {
  return {
    validationMode: "unknown",
    trustedStateAvailable: false,
    snapshotUsed: false,
    stateSources: {
      credits: "unknown",
      cargoUsed: "unknown",
      cargoCapacity: "unknown"
    },
    readStatus,
    blockReason: reason,
    userReason: "Player state unavailable; showing price preview only.",
    creditsAvailable: null,
    cargoUsed: null,
    cargoCapacity: null,
    cargoFree: null,
    maxAffordableQuantity: null,
    maxCargoQuantity: null,
    maxValidQuantity: null
  };
}

function sanitizePlayerSnapshot(playerSnapshot) {
  if (!playerSnapshot || typeof playerSnapshot !== "object") {
    return getUnknownValidation();
  }

  const creditsAvailable = normalizeTradeNumber(playerSnapshot.credits, 999999999);
  const cargoUsed = normalizeTradeNumber(playerSnapshot.cargoUsed, 999999);
  const cargoCapacity = normalizeTradeNumber(playerSnapshot.cargoCapacity, 999999);

  if (creditsAvailable === null || cargoUsed === null || cargoCapacity === null) {
    return getUnknownValidation();
  }

  const safeCargoUsed = Math.max(0, Math.min(cargoCapacity, cargoUsed));
  const cargoFree = Math.max(0, cargoCapacity - safeCargoUsed);

  return {
    validationMode: "snapshot",
    trustedStateAvailable: false,
    snapshotUsed: true,
    stateSources: {
      credits: "snapshot",
      cargoUsed: "snapshot",
      cargoCapacity: "snapshot"
    },
    readStatus: "",
    blockReason: null,
    userReason: "Dry run valid.",
    creditsAvailable,
    cargoUsed: safeCargoUsed,
    cargoCapacity,
    cargoFree,
    maxAffordableQuantity: null,
    maxCargoQuantity: cargoFree,
    maxValidQuantity: null
  };
}

function sanitizeTrustedState(trustedState) {
  const state = trustedState?.validationState || {};
  const creditsAvailable = normalizeTradeNumber(state.credits, 999999999);
  const cargoUsed = normalizeTradeNumber(state.cargoUsed, 999999);
  const cargoCapacity = normalizeTradeNumber(state.cargoCapacity, 999999);

  if (!trustedState?.available || creditsAvailable === null || cargoUsed === null) {
    return null;
  }

  return {
    validationMode: "trusted_save",
    trustedStateAvailable: true,
    snapshotUsed: false,
    stateSources: {
      credits: "trusted_save",
      cargoUsed: "trusted_save",
      cargoCapacity: cargoCapacity === null ? "unknown" : "trusted_save",
      ...(trustedState.stateSources || {})
    },
    readStatus: trustedState.reason || "ok",
    blockReason: null,
    userReason: "Dry run valid.",
    creditsAvailable,
    cargoUsed,
    cargoCapacity,
    cargoFree: cargoCapacity === null ? null : Math.max(0, cargoCapacity - Math.min(cargoUsed, cargoCapacity)),
    maxAffordableQuantity: null,
    maxCargoQuantity: cargoCapacity === null ? null : Math.max(0, cargoCapacity - Math.min(cargoUsed, cargoCapacity)),
    maxValidQuantity: null
  };
}

function getValidationSource({ playerSnapshot, trustedState }) {
  const snapshot = sanitizePlayerSnapshot(playerSnapshot);
  const trusted = sanitizeTrustedState(trustedState);

  if (trusted) {
    const snapshotCapacity = snapshot.validationMode === "snapshot" ? snapshot.cargoCapacity : null;
    const cargoCapacity = trusted.cargoCapacity === null ? snapshotCapacity : trusted.cargoCapacity;
    if (cargoCapacity !== null) {
      const cargoUsed = Math.max(0, Math.min(cargoCapacity, trusted.cargoUsed));
      return {
        ...trusted,
        snapshotUsed: trusted.cargoCapacity === null && snapshot.validationMode === "snapshot",
        stateSources: {
          ...trusted.stateSources,
          cargoCapacity: trusted.cargoCapacity === null ? "snapshot" : "trusted_save"
        },
        cargoUsed,
        cargoCapacity,
        cargoFree: Math.max(0, cargoCapacity - cargoUsed),
        maxCargoQuantity: Math.max(0, cargoCapacity - cargoUsed)
      };
    }
  }

  if (snapshot.validationMode === "snapshot") {
    return {
      ...snapshot,
      readStatus: trustedState?.reason || ""
    };
  }

  return {
    ...getUnknownValidation("unknown_player_state", trustedState?.reason || ""),
    trustedStateAvailable: trustedState?.available === true
  };
}

function getTradeValidation({ offer, quantity, playerSnapshot, trustedState }) {
  const validation = getValidationSource({ playerSnapshot, trustedState });
  if (validation.validationMode === "unknown") {
    return {
      ...validation,
      wouldPass: false
    };
  }

  const maxAffordableQuantity = offer.buyPrice > 0
    ? Math.floor(validation.creditsAvailable / offer.buyPrice)
    : 0;
  const maxCargoQuantity = validation.cargoFree;
  const maxValidQuantity = Math.max(0, Math.min(maxAffordableQuantity, maxCargoQuantity));
  const insufficientCredits = quantity > maxAffordableQuantity;
  const insufficientCargo = quantity > maxCargoQuantity;
  const blockReason = insufficientCredits
    ? "insufficient_credits"
    : insufficientCargo
      ? "insufficient_cargo"
      : null;
  const userReason = insufficientCredits
    ? "Not enough credits for this quantity."
    : insufficientCargo
      ? "Not enough cargo space for this quantity."
      : "Dry run valid.";

  return {
    ...validation,
    wouldPass: blockReason === null,
    blockReason,
    userReason,
    maxAffordableQuantity,
    maxCargoQuantity,
    maxValidQuantity
  };
}

function getRejectedValidation({ playerSnapshot, trustedState }) {
  const validation = getValidationSource({ playerSnapshot, trustedState });
  return {
    validationMode: validation.validationMode,
    trustedStateAvailable: validation.trustedStateAvailable,
    snapshotUsed: validation.snapshotUsed,
    stateSources: validation.stateSources,
    readStatus: validation.readStatus
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

function normalizeStagingTradeWriteScope(value, fallback = "disabled") {
  const requestedScope = String(value || fallback).trim().toLowerCase();
  const supported = requestedScope === "all" || requestedScope === "verified" || requestedScope === "allowlist" || requestedScope === "disabled";
  return {
    requestedScope,
    scope: supported ? requestedScope : "invalid",
    scopeInvalid: !supported
  };
}

export function getStagingTradeWriteConfig(env = process.env) {
  const maxQuantity = normalizeTradeNumber(env.STAGING_TRADE_WRITE_MAX_QUANTITY, 1000) || 1000;
  const allowlist = getCsvSet(env.STAGING_TRADE_WRITE_ALLOWLIST);
  const allowedOffers = getCsvSet(env.STAGING_TRADE_WRITE_ALLOWED_OFFERS);
  const scopeGate = normalizeStagingTradeWriteScope(env.STAGING_TRADE_WRITE_SCOPE, "disabled");

  return {
    writeEnabled: getBooleanEnv(env.STAGING_TRADE_WRITE_ENABLED, false),
    // Defaults to dry-run. Phase 5b real buy writes require this env flag to
    // be explicitly false plus all other staging identity/save gates.
    dryRun: getBooleanEnv(env.STAGING_TRADE_WRITE_DRY_RUN, true),
    envDryRun: getBooleanEnv(env.STAGING_TRADE_WRITE_DRY_RUN, true),
    scope: scopeGate.scope,
    requestedScope: scopeGate.requestedScope,
    scopeInvalid: scopeGate.scopeInvalid,
    allowlistPresent: allowlist.size > 0,
    allowlist,
    maxQuantity,
    allowedOffersPresent: allowedOffers.size > 0,
    allowedOffers
  };
}

function getTradeWriteGates({ identity = {}, trustedState = null, config = getStagingTradeWriteConfig() } = {}) {
  const playerId = String(identity.trustedPlayerId || identity.playerId || "");
  const verified = identity.authStatus === "verified" && !!playerId;
  const allowlisted = config.scope === "all" || config.scope === "verified"
    ? verified
    : config.scope === "allowlist" && verified && config.allowlist.has(playerId);

  return {
    verified,
    writeEnabled: config.writeEnabled === true,
    dryRun: config.dryRun !== false,
    allowlisted,
    scope: config.scope,
    requestedScope: config.requestedScope,
    scopeInvalid: config.scopeInvalid === true,
    trustedSaveAvailable: trustedState?.available === true,
    maxQuantity: config.maxQuantity,
    allowedOffersPresent: config.allowedOffersPresent
  };
}

function getWriteFlags() {
  return {
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    inventoryWritten: false,
    lootWritten: false,
    bountyWritten: false
  };
}

function buildBlockedTradeWriteResult({
  operation,
  offerId = "",
  quantity = 0,
  reason,
  debugReason,
  offer = null,
  validation = null,
  gates = {}
} = {}) {
  return {
    ok: false,
    mode: "blocked",
    operation,
    applied: false,
    offerId: offer?.offerId || String(offerId || ""),
    resourceId: offer?.resourceId || "",
    resourceName: offer?.resourceName || "",
    quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : 0,
    cost: 0,
    revenue: 0,
    creditsDelta: 0,
    cargoDelta: 0,
    creditsBefore: validation?.creditsAvailable ?? null,
    creditsAfter: validation?.creditsAvailable ?? null,
    cargoBefore: null,
    cargoAfter: null,
    validationMode: validation?.validationMode || "unknown",
    trustedStateAvailable: validation?.trustedStateAvailable === true,
    snapshotUsed: validation?.snapshotUsed === true,
    wouldPass: false,
    blockReason: reason,
    userReason: debugReason || reason,
    gates,
    writes: getWriteFlags(),
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    reason,
    debugReason
  };
}

export function buildStagingTradeWriteDryRun({
  operation = "buy",
  offerId = "",
  quantity = 1,
  playerSnapshot = null,
  trustedState = null,
  identity = {},
  env = process.env
} = {}) {
  const safeOperation = operation === "sell" ? "sell" : "buy";
  const config = getStagingTradeWriteConfig(env);
  const offer = getStagingTradeOfferById(offerId);
  const requestedQuantity = Number(quantity);
  const gates = getTradeWriteGates({ identity, trustedState, config });

  if (!offer) {
    return buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity,
      reason: "unknown_trade_offer",
      debugReason: "unknown_trade_offer",
      gates
    });
  }

  if (config.allowedOffersPresent && !config.allowedOffers.has(offer.offerId)) {
    return buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity,
      reason: "trade_offer_not_allowed",
      debugReason: "offer_not_in_STAGING_TRADE_WRITE_ALLOWED_OFFERS",
      offer,
      gates
    });
  }

  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity,
      reason: "invalid_trade_quantity",
      debugReason: "quantity_must_be_positive_integer",
      offer,
      gates
    });
  }

  if (requestedQuantity > config.maxQuantity) {
    return buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity: requestedQuantity,
      reason: "quantity_exceeds_staging_trade_write_limit",
      debugReason: `max_quantity_${config.maxQuantity}`,
      offer,
      gates
    });
  }

  const preview = buildStagingTradePreview({
    offerId: offer.offerId,
    quantity: requestedQuantity,
    playerSnapshot,
    trustedState
  });
  const validation = {
    ...preview,
    creditsAvailable: preview.creditsAvailable,
    trustedStateAvailable: preview.trustedStateAvailable,
    snapshotUsed: preview.snapshotUsed
  };

  if (safeOperation === "buy" && preview.wouldPass !== true) {
    return buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity: requestedQuantity,
      reason: preview.blockReason || "trade_validation_failed",
      debugReason: preview.userReason || preview.debugReason || "buy_validation_failed",
      offer,
      validation,
      gates
    });
  }

  const cargoByResource = trustedState?.validationState?.cargoByResource;
  const trustedCargo = readResourceDebug(cargoByResource, offer);
  const resourceHeld = trustedCargo.amount;
  const costBasisDebug = readResourceDebug(trustedState?.validationState?.cargoCostBasisByResource, offer, 999999999);
  const sellDebug = safeOperation === "sell"
    ? {
      writeHandlerUsed: "preflight",
      dryRunEnv: config.envDryRun,
      sellValidationReason: "preflight",
      trustedCargo,
      costBasisFound: costBasisDebug.found && costBasisDebug.amount !== null,
      cargoCostBasisKey: costBasisDebug.key,
      cargoCostBasisBefore: costBasisDebug.amount
    }
    : {};

  if (safeOperation === "sell" && resourceHeld === null) {
    return {
      ...buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity: requestedQuantity,
      reason: "unknown_resource_cargo",
      debugReason: "resource_level_cargo_validation_unavailable",
      offer,
      validation,
      gates
      }),
      ...sellDebug,
      sellValidationReason: "resource_level_cargo_validation_unavailable"
    };
  }

  if (safeOperation === "sell" && resourceHeld < requestedQuantity) {
    return {
      ...buildBlockedTradeWriteResult({
      operation: safeOperation,
      offerId,
      quantity: requestedQuantity,
      reason: "insufficient_resource_cargo",
      debugReason: "not_enough_saved_resource_cargo",
      offer,
      validation,
      gates
      }),
      ...sellDebug,
      sellValidationReason: "not_enough_saved_resource_cargo"
    };
  }

  const cost = safeOperation === "buy" ? offer.buyPrice * requestedQuantity : 0;
  const revenue = safeOperation === "sell" ? offer.sellPrice * requestedQuantity : 0;
  const creditsBefore = preview.creditsAvailable ?? trustedState?.validationState?.credits ?? null;
  const validationMode = safeOperation === "sell" && preview.validationMode === "unknown" && trustedState?.available
    ? "trusted_save_limited"
    : preview.validationMode;
  const creditsDelta = safeOperation === "buy" ? -cost : revenue;
  const cargoDelta = safeOperation === "buy" ? requestedQuantity : -requestedQuantity;
  const cargoBefore = safeOperation === "sell" ? resourceHeld : null;

  return {
    ok: true,
    mode: "dry_run",
    operation: safeOperation,
    applied: false,
    offerId: offer.offerId,
    resourceId: offer.resourceId,
    resourceName: offer.resourceName,
    quantity: requestedQuantity,
    buyNode: offer.buyNode,
    sellNode: offer.sellNode,
    cost,
    revenue,
    profitPreview: safeOperation === "buy"
      ? (offer.sellPrice - offer.buyPrice) * requestedQuantity
      : revenue,
    creditsDelta,
    cargoDelta,
    creditsBefore,
    creditsAfter: creditsBefore === null ? null : Math.max(0, creditsBefore + creditsDelta),
    cargoBefore,
    cargoAfter: cargoBefore === null ? null : Math.max(0, cargoBefore + cargoDelta),
    validationMode,
    trustedStateAvailable: preview.trustedStateAvailable,
    snapshotUsed: preview.snapshotUsed,
    stateSources: preview.stateSources,
    readStatus: preview.readStatus,
    wouldPass: true,
    blockReason: null,
    userReason: safeOperation === "buy"
      ? "Would buy if staging trade writes were enabled."
      : "Would sell if staging trade writes were enabled.",
    ...sellDebug,
    sellValidationReason: safeOperation === "sell" ? "trusted_resource_cargo_available" : undefined,
    gates,
    writes: getWriteFlags(),
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    reason: `staging_trade_${safeOperation}_dry_run`,
    debugReason: "phase5a_write_path_scaffold_no_save_write"
  };
}

export function buildStagingTradePreview({
  offerId = "",
  quantity = 1,
  playerSnapshot = null,
  trustedState = null
} = {}) {
  const offer = getStagingTradeOfferById(offerId);
  const requestedQuantity = Number(quantity);

  if (!offer) {
    return {
      ok: false,
      mode: "dry_run",
      applied: false,
      offerId: String(offerId || ""),
      reason: "unknown_trade_offer",
      debugReason: "unknown_trade_offer",
      wouldPass: false,
      validationMode: "unknown",
      trustedStateAvailable: false,
      snapshotUsed: false,
      stateSources: {},
      readStatus: "",
      blockReason: "unknown_trade_offer",
      userReason: "Unknown staging trade offer.",
      creditsWritten: false,
      cargoWritten: false,
      saveWritten: false
    };
  }

  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return {
      ok: false,
      mode: "dry_run",
      applied: false,
      offerId: offer.offerId,
      reason: "invalid_trade_quantity",
      debugReason: "quantity_must_be_positive_integer",
      wouldPass: false,
      ...getRejectedValidation({ playerSnapshot, trustedState }),
      blockReason: "invalid_quantity",
      userReason: "Invalid trade quantity.",
      creditsWritten: false,
      cargoWritten: false,
      saveWritten: false
    };
  }

  const totalCost = offer.buyPrice * requestedQuantity;
  const projectedRevenue = offer.sellPrice * requestedQuantity;
  const projectedProfit = projectedRevenue - totalCost;
  const validation = getTradeValidation({
    offer,
    quantity: requestedQuantity,
    playerSnapshot,
    trustedState
  });

  return {
    ok: true,
    mode: "dry_run",
    applied: false,
    offerId: offer.offerId,
    resourceId: offer.resourceId,
    resourceName: offer.resourceName,
    quantity: requestedQuantity,
    buyNode: offer.buyNode,
    sellNode: offer.sellNode,
    buyPrice: offer.buyPrice,
    sellPrice: offer.sellPrice,
    totalCost,
    projectedRevenue,
    projectedProfit,
    wouldPass: validation.wouldPass,
    validationMode: validation.validationMode,
    trustedStateAvailable: validation.trustedStateAvailable,
    snapshotUsed: validation.snapshotUsed,
    stateSources: validation.stateSources,
    readStatus: validation.readStatus,
    blockReason: validation.blockReason,
    userReason: validation.userReason,
    creditsAvailable: validation.creditsAvailable,
    cargoUsed: validation.cargoUsed,
    cargoCapacity: validation.cargoCapacity,
    cargoFree: validation.cargoFree,
    maxAffordableQuantity: validation.maxAffordableQuantity,
    maxCargoQuantity: validation.maxCargoQuantity,
    maxValidQuantity: validation.maxValidQuantity,
    enoughCredits: validation.validationMode !== "unknown"
      ? requestedQuantity <= validation.maxAffordableQuantity
      : null,
    enoughCargo: validation.validationMode !== "unknown"
      ? requestedQuantity <= validation.maxCargoQuantity
      : null,
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    reason: "staging_trade_preview_only",
    debugReason: "dry_run_no_credit_or_cargo_writes"
  };
}
