/* Static staging trade preview config.
   This is intentionally deterministic server-side data for multiplayer trade
   dry-runs only. It does not read Supabase and never writes credits, cargo,
   inventory, player_saves, bounties, or progression. */

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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sanitizePlayerSnapshot(playerSnapshot) {
  if (!playerSnapshot || typeof playerSnapshot !== "object") {
    return {
      validationMode: "unknown",
      blockReason: "unknown_player_state",
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

  const creditsAvailable = getFiniteNumber(playerSnapshot.credits);
  const cargoUsed = getFiniteNumber(playerSnapshot.cargoUsed);
  const cargoCapacity = getFiniteNumber(playerSnapshot.cargoCapacity);

  if (creditsAvailable === null || cargoUsed === null || cargoCapacity === null) {
    return {
      validationMode: "unknown",
      blockReason: "unknown_player_state",
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

  const safeCredits = Math.max(0, Math.min(999999999, Math.floor(creditsAvailable)));
  const safeCargoCapacity = Math.max(0, Math.min(999999, Math.floor(cargoCapacity)));
  const safeCargoUsed = Math.max(0, Math.min(safeCargoCapacity, Math.floor(cargoUsed)));
  const cargoFree = Math.max(0, safeCargoCapacity - safeCargoUsed);

  return {
    validationMode: "snapshot",
    blockReason: null,
    userReason: "Dry run valid.",
    creditsAvailable: safeCredits,
    cargoUsed: safeCargoUsed,
    cargoCapacity: safeCargoCapacity,
    cargoFree,
    maxAffordableQuantity: null,
    maxCargoQuantity: cargoFree,
    maxValidQuantity: null
  };
}

function getTradeValidation({ offer, quantity, playerSnapshot }) {
  const snapshot = sanitizePlayerSnapshot(playerSnapshot);
  if (snapshot.validationMode === "unknown") {
    return {
      ...snapshot,
      wouldPass: false
    };
  }

  const maxAffordableQuantity = offer.buyPrice > 0
    ? Math.floor(snapshot.creditsAvailable / offer.buyPrice)
    : 0;
  const maxCargoQuantity = snapshot.cargoFree;
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
    ...snapshot,
    wouldPass: blockReason === null,
    blockReason,
    userReason,
    maxAffordableQuantity,
    maxCargoQuantity,
    maxValidQuantity
  };
}

export function buildStagingTradePreview({ offerId = "", quantity = 1, playerSnapshot = null } = {}) {
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
      validationMode: playerSnapshot && typeof playerSnapshot === "object" ? "snapshot" : "unknown",
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
      validationMode: playerSnapshot && typeof playerSnapshot === "object" ? "snapshot" : "unknown",
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
    playerSnapshot
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
    blockReason: validation.blockReason,
    userReason: validation.userReason,
    creditsAvailable: validation.creditsAvailable,
    cargoUsed: validation.cargoUsed,
    cargoCapacity: validation.cargoCapacity,
    cargoFree: validation.cargoFree,
    maxAffordableQuantity: validation.maxAffordableQuantity,
    maxCargoQuantity: validation.maxCargoQuantity,
    maxValidQuantity: validation.maxValidQuantity,
    enoughCredits: validation.validationMode === "snapshot"
      ? requestedQuantity <= validation.maxAffordableQuantity
      : null,
    enoughCargo: validation.validationMode === "snapshot"
      ? requestedQuantity <= validation.maxCargoQuantity
      : null,
    creditsWritten: false,
    cargoWritten: false,
    saveWritten: false,
    reason: "staging_trade_preview_only",
    debugReason: "dry_run_no_credit_or_cargo_writes"
  };
}
