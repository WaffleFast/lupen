/* Static staging trade preview config.
   This is intentionally deterministic server-side data for multiplayer trade
   dry-runs only. It never writes credits, cargo, inventory, player_saves,
   bounties, or progression. Trusted save reads may be used only to validate
   dry-run feasibility for verified staging players. */

export const STAGING_TRADE_OFFERS = Object.freeze([
  Object.freeze({
    offerId: "staging-iron-asteron-virella",
    resourceId: "iron",
    resourceName: "Iron",
    buyNode: "Asteron Prime",
    sellNode: "Virella",
    buyPrice: 18,
    sellPrice: 25,
    maxQuantity: 40,
    refreshSeconds: 300
  }),
  Object.freeze({
    offerId: "staging-copper-virella-nyxara",
    resourceId: "copper",
    resourceName: "Copper",
    buyNode: "Virella",
    sellNode: "Nyxara",
    buyPrice: 32,
    sellPrice: 43,
    maxQuantity: 30,
    refreshSeconds: 300
  }),
  Object.freeze({
    offerId: "staging-cobalt-nyxara-asteron",
    resourceId: "cobalt",
    resourceName: "Cobalt",
    buyNode: "Nyxara",
    sellNode: "Asteron Prime",
    buyPrice: 62,
    sellPrice: 79,
    maxQuantity: 18,
    refreshSeconds: 300
  }),
  Object.freeze({
    offerId: "staging-crystal-asteron-nyxara",
    resourceId: "crystal_shards",
    resourceName: "Crystal Shards",
    buyNode: "Asteron Prime",
    sellNode: "Nyxara",
    buyPrice: 95,
    sellPrice: 128,
    maxQuantity: 10,
    refreshSeconds: 300
  })
]);

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
  const maxValidQuantity = Math.max(0, Math.min(maxAffordableQuantity, maxCargoQuantity, offer.maxQuantity));
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

  if (requestedQuantity > offer.maxQuantity) {
    return {
      ok: false,
      mode: "dry_run",
      applied: false,
      offerId: offer.offerId,
      reason: "quantity_exceeds_staging_offer_limit",
      debugReason: "quantity_exceeds_max_quantity",
      maxQuantity: offer.maxQuantity,
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
