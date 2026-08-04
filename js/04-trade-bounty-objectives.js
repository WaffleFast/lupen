/* Marketplace */

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

function isMultiplayerStagingActive() {
  try {
    return typeof window !== "undefined" &&
      window.location &&
      new URLSearchParams(window.location.search).get("mp") === "staging";
  } catch (_err) {
    return false;
  }
}

function isLocalTutorialTradeActive() {
  return typeof shouldUseLocalTutorialTrade === "function" && shouldUseLocalTutorialTrade();
}

let multiplayerStagingTradePending = null;
let multiplayerStagingTradeLastHandledAt = 0;
let multiplayerStagingTradeSyncStatus = null;
// Mirrors the current Colyseus STAGING_TRADE_WRITE_MAX_QUANTITY gate so the
// Trade Builder never asks staging to write more than the server will accept.
const MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY = 1000;
const MULTIPLAYER_STAGING_TRADE_RESOURCES = Object.freeze([
  Object.freeze({ resourceId: "iron", resourceName: "Iron" }),
  Object.freeze({ resourceId: "copper", resourceName: "Copper" }),
  Object.freeze({ resourceId: "cobalt", resourceName: "Cobalt" })
]);
const MULTIPLAYER_STAGING_TRADE_PRICE_TABLE = Object.freeze({
  "Asteron Prime": Object.freeze({ Iron: 18, Copper: 38, Cobalt: 90 }),
  Virella: Object.freeze({ Iron: 20, Copper: 50, Cobalt: 74 }),
  Nyxara: Object.freeze({ Iron: 30, Copper: 32, Cobalt: 102 })
});
const MULTIPLAYER_STAGING_TRADE_PLANET_SLUGS = Object.freeze({
  "Asteron Prime": "asteron",
  Virella: "virella",
  Nyxara: "nyxara"
});
const MULTIPLAYER_STAGING_TRADE_RESOURCE_SLUGS = Object.freeze({});

function getMultiplayerStagingTradeOfferId(resourceId = "", buyNode = "", sellNode = "") {
  return [
    "staging",
    MULTIPLAYER_STAGING_TRADE_RESOURCE_SLUGS[resourceId] || String(resourceId || "").replace(/_/g, "-"),
    MULTIPLAYER_STAGING_TRADE_PLANET_SLUGS[buyNode] || String(buyNode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    MULTIPLAYER_STAGING_TRADE_PLANET_SLUGS[sellNode] || String(sellNode || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  ].filter(Boolean).join("-");
}

function buildMultiplayerStagingTradeOfferFallbacks() {
  const planets = Object.keys(MULTIPLAYER_STAGING_TRADE_PRICE_TABLE);
  const refreshMs = typeof TRADE_MARKET_REFRESH_MS !== "undefined" ? TRADE_MARKET_REFRESH_MS : 180000;
  const cycle = typeof getMarketCycle === "function" ? getMarketCycle() : Math.floor(Date.now() / refreshMs);
  const getFallbackPrice = (resourceName, planet, priceCycle) => {
    if (typeof getLiveMarketPriceForCycle === "function") {
      return getLiveMarketPriceForCycle(resourceName, planet, priceCycle);
    }
    return MULTIPLAYER_STAGING_TRADE_PRICE_TABLE[planet][resourceName];
  };
  return MULTIPLAYER_STAGING_TRADE_RESOURCES.flatMap((resource) => {
    return planets.flatMap((buyNode) => {
      return planets
        .filter((sellNode) => sellNode !== buyNode)
        .map((sellNode) => Object.freeze({
          offerId: getMultiplayerStagingTradeOfferId(resource.resourceId, buyNode, sellNode),
          resourceId: resource.resourceId,
          resourceName: resource.resourceName,
          buyNode,
          sellNode,
          buyPrice: getFallbackPrice(resource.resourceName, buyNode, cycle),
          sellPrice: getFallbackPrice(resource.resourceName, sellNode, cycle),
          previousBuyPrice: getFallbackPrice(resource.resourceName, buyNode, cycle - 1),
          previousSellPrice: getFallbackPrice(resource.resourceName, sellNode, cycle - 1),
          marketCycle: cycle,
          refreshSeconds: Math.ceil(refreshMs / 1000),
          maxQuantity: MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY
        }));
    });
  });
}

function blockRealTradeMutationInMultiplayerStaging() {
  if (!isMultiplayerStagingActive()) return false;

  const message = "Trading is temporarily unavailable. Please try again shortly.";
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[Lupen multiplayer] ${message}`);
  }
  return true;
}

function isMultiplayerStagingTradeReady() {
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  return isMultiplayerStagingActive() && client && status?.enabled && status?.isConnected;
}

function getMultiplayerStagingTradeStatus() {
  return window.LupenMultiplayerClient?.getStatus?.() || {};
}

function getMultiplayerStagingTradeOffers() {
  const status = getMultiplayerStagingTradeStatus();
  return Array.isArray(status.lastStagingTradeOffers?.offers) && status.lastStagingTradeOffers.offers.length
    ? status.lastStagingTradeOffers.offers
    : isMultiplayerStagingActive()
      ? buildMultiplayerStagingTradeOfferFallbacks()
      : [];
}

function requestMultiplayerStagingTradeOffersIfNeeded() {
  if (!isMultiplayerStagingActive()) return;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.requestStagingTradeOffers || !status?.enabled || !status?.isConnected) return;
  if (Array.isArray(status.lastStagingTradeOffers?.offers) && status.lastStagingTradeOffers.offers.length) return;
  client.requestStagingTradeOffers();
}

function normalizeTradeRouteValue(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeMultiplayerStagingResourceKey(value) {
  return normalizeTradeRouteValue(value).replace(/_/g, " ");
}

function isMultiplayerStagingOfferForResource(offer, good) {
  const normalizedGood = normalizeMultiplayerStagingResourceKey(good);
  return normalizeMultiplayerStagingResourceKey(offer?.resourceName) === normalizedGood ||
    normalizeMultiplayerStagingResourceKey(offer?.resourceId) === normalizedGood;
}

function findMultiplayerStagingTradeOffer({ good = "", origin = "", destination = "" } = {}) {
  const normalizedOrigin = normalizeTradeRouteValue(origin);
  const normalizedDestination = normalizeTradeRouteValue(destination);
  return getMultiplayerStagingTradeOffers().find((offer) => {
    return isMultiplayerStagingOfferForResource(offer, good) &&
      normalizeTradeRouteValue(offer.buyNode) === normalizedOrigin &&
      normalizeTradeRouteValue(offer.sellNode) === normalizedDestination;
  }) || null;
}

function getMultiplayerStagingRoutePricing({ good = "", origin = "", destination = "" } = {}) {
  const offer = findMultiplayerStagingTradeOffer({ good, origin, destination });
  if (!offer) return null;
  return {
    offer,
    buyPrice: Number(offer.buyPrice || 0),
    sellPrice: Number(offer.sellPrice || 0)
  };
}

function getMultiplayerStagingBuyOffersAt(origin = getCurrentMarketPlanet()) {
  const normalizedOrigin = normalizeTradeRouteValue(origin);
  return getMultiplayerStagingTradeOffers().filter((offer) => normalizeTradeRouteValue(offer.buyNode) === normalizedOrigin);
}

function getMultiplayerStagingSellOffersAt(destination = getCurrentMarketPlanet()) {
  const normalizedDestination = normalizeTradeRouteValue(destination);
  return getMultiplayerStagingTradeOffers().filter((offer) => normalizeTradeRouteValue(offer.sellNode) === normalizedDestination);
}

function findMultiplayerStagingSellOffer({ good = "", destination = getCurrentMarketPlanet() } = {}) {
  return getMultiplayerStagingSellOffersAt(destination).find((offer) => isMultiplayerStagingOfferForResource(offer, good)) || null;
}

function findCargoCostBasisKeyForResource(good = "") {
  const normalizedGood = normalizeMultiplayerStagingResourceKey(good);
  if (!normalizedGood || !cargoCostBasis || typeof cargoCostBasis !== "object") return "";
  return Object.keys(cargoCostBasis).find((key) => normalizeMultiplayerStagingResourceKey(key) === normalizedGood) || "";
}

function getCargoCostBasisForResource(good = "") {
  const basisKey = findCargoCostBasisKeyForResource(good);
  const basis = basisKey ? Number(cargoCostBasis[basisKey]) : NaN;
  return Number.isFinite(basis) && basis > 0 ? basis : null;
}

function getLegacyPurchasedCargoQuantity(good = "") {
  const held = Math.max(0, Number(cargo[good] || 0));
  const recovered = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(good) : 0;
  return Math.max(0, held - recovered);
}

function updateLegacyPurchasedCargoCostBasis(good, quantity, price) {
  const boughtQuantity = Math.max(0, Math.round(Number(quantity || 0)));
  const unitPrice = Number(price || 0);
  if (!good || !boughtQuantity || !Number.isFinite(unitPrice) || unitPrice <= 0) return;
  const purchasedBefore = Math.max(0, getPurchasedCargoQuantity(good) - boughtQuantity);
  const previousBasis = cargoCostBasis[good] || unitPrice;
  cargoCostBasis[good] = Math.round(((purchasedBefore * previousBasis) + (boughtQuantity * unitPrice)) / Math.max(1, purchasedBefore + boughtQuantity));
}

function getMultiplayerStagingOfferQuantityLimit(_offer) {
  return MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY;
}

function getMultiplayerStagingMaxBuyQuantity({ good = selectedMarketResource, origin = getCurrentMarketPlanet(), destination = selectedMarketTargetPlanet } = {}) {
  const routePricing = getMultiplayerStagingRoutePricing({ good, origin, destination });
  const price = isMultiplayerStagingActive()
    ? Number(routePricing?.buyPrice || 0)
    : Number(getMapOneMarketPrice(good, origin) || 0);
  const maxAffordable = price > 0 ? Math.floor(credits / price) : 0;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  return Math.max(0, Math.min(maxAffordable, freeCargo));
}

function getMultiplayerStagingTradeQuantityLimit({
  operation = "buy",
  good = selectedMarketResource,
  origin = getCurrentMarketPlanet(),
  destination = selectedMarketTargetPlanet
} = {}) {
  if (!isMultiplayerStagingActive()) return Math.max(1, getMarketMaxBuyQuantity(good, origin));
  const sellMode = operation === "sell";
  const offer = sellMode
    ? findMultiplayerStagingSellOffer({ good, destination: origin })
    : findMultiplayerStagingTradeOffer({ good, origin, destination });
  const serverLimit = getMultiplayerStagingOfferQuantityLimit(offer);
  if (sellMode) {
    return Math.max(0, Math.min(Number(cargo[good] || 0), serverLimit));
  }
  return Math.max(0, Math.min(getMultiplayerStagingMaxBuyQuantity({ good, origin, destination }), serverLimit));
}

function getMultiplayerStagingTargetPlanetsForResource(good, origin = getCurrentMarketPlanet()) {
  return getMultiplayerStagingBuyOffersAt(origin)
    .filter((offer) => isMultiplayerStagingOfferForResource(offer, good))
    .map((offer) => offer.sellNode)
    .filter((node, index, nodes) => node && nodes.indexOf(node) === index);
}

function getBestMultiplayerStagingTargetPlanet(good, origin = getCurrentMarketPlanet()) {
  const offers = getMultiplayerStagingBuyOffersAt(origin)
    .filter((offer) => isMultiplayerStagingOfferForResource(offer, good) && offer.sellNode !== origin)
    .sort((a, b) => {
      const profitA = Number(a.sellPrice || 0) - Number(a.buyPrice || 0);
      const profitB = Number(b.sellPrice || 0) - Number(b.buyPrice || 0);
      return profitB - profitA;
    });
  return offers[0]?.sellNode || "";
}

function hasMultiplayerStagingBuyRoute(good, origin = getCurrentMarketPlanet()) {
  return getMultiplayerStagingTargetPlanetsForResource(good, origin).length > 0;
}

function hasMultiplayerStagingSellRoute(good, destination = getCurrentMarketPlanet()) {
  return Boolean(findMultiplayerStagingSellOffer({ good, destination }));
}

function getMultiplayerStagingSellableCargoAt(destination = getCurrentMarketPlanet()) {
  if (!isMultiplayerStagingActive()) return [];
  return MAP_ONE_TRADE_RESOURCES.filter((good) => {
    return Number(cargo[good] || 0) > 0 && hasMultiplayerStagingSellRoute(good, destination);
  });
}

function canSelectMultiplayerStagingMarketResource(good, currentPlanet = getCurrentMarketPlanet()) {
  if (!isMultiplayerStagingActive()) return true;
  const offers = getMultiplayerStagingTradeOffers();
  if (!offers.length) return true;
  return hasMultiplayerStagingBuyRoute(good, currentPlanet) ||
    ((cargo[good] || 0) > 0 && hasMultiplayerStagingSellRoute(good, currentPlanet));
}

function getMultiplayerStagingMarketPrice(good, planet, currentPlanet = getCurrentMarketPlanet()) {
  if (!isMultiplayerStagingActive()) return null;
  if (planet === currentPlanet) {
    const buyOffer = getMultiplayerStagingBuyOffersAt(currentPlanet).find((offer) => {
      return isMultiplayerStagingOfferForResource(offer, good);
    });
    if (buyOffer) return buyOffer.buyPrice;
    const sellOffer = findMultiplayerStagingSellOffer({ good, destination: currentPlanet });
    return sellOffer ? sellOffer.sellPrice : null;
  }
  const offer = findMultiplayerStagingTradeOffer({ good, origin: currentPlanet, destination: planet });
  return offer ? offer.sellPrice : null;
}

function getMultiplayerStagingTradeSourceLabel(result) {
  if (!result) return "Checking route availability";
  if (result.validationMode === "trusted_save") {
    return result.snapshotUsed ? "Validated from trusted save + capacity snapshot" : "Validated from trusted save";
  }
  if (result.validationMode === "snapshot") return "Validated from client snapshot";
  return "Price preview only - player state unavailable";
}

function getMultiplayerStagingTradeValidationLabel(result) {
  if (!result) return "";
  if (result.validationMode === "unknown") return "Server price preview only";
  if (result.wouldPass) return "Would pass validation";
  if (result.blockReason === "insufficient_credits") return "Blocked: not enough credits";
  if (result.blockReason === "insufficient_cargo") return "Blocked: not enough cargo space";
  if (result.blockReason === "invalid_quantity") return "Blocked: invalid quantity";
  if (result.reason === "quantity_exceeds_staging_trade_write_limit" || result.blockReason === "quantity_exceeds_staging_trade_write_limit") {
    return "Blocked: quantity exceeds staging limit";
  }
  return `Blocked: ${result.blockReason || result.reason || "validation failed"}`;
}

function isMultiplayerStagingDebugActive() {
  return new URLSearchParams(window.location.search).get("debug") === "mp";
}

function escapeMultiplayerStagingTradeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMultiplayerStagingTradeWriteBlockLine(result) {
  if (!result || result.applied === true) return "";
  const reason = result.userReason || result.writeBlockReason || result.blockReason || result.reason || "";
  const code = result.writeBlockReason || result.blockReason || result.reason || "";
  if (!reason && !code) return "";
  const playerReason = code === "quantity_exceeds_staging_trade_write_limit"
    ? "Quantity exceeds staging limit."
    : reason;
  const codeLine = code && isMultiplayerStagingDebugActive()
    ? ` <span>Gate: ${escapeMultiplayerStagingTradeText(code)}</span>`
    : "";
  return `<span>${escapeMultiplayerStagingTradeText(playerReason || `Blocked: ${code}`)}</span>${codeLine}`;
}

function getLastMatchingMultiplayerStagingTradePreview(offerId, operation = "") {
  const status = getMultiplayerStagingTradeStatus();
  const writeResult = status.lastStagingTradeWriteResult;
  if (writeResult?.offerId === offerId && (!operation || writeResult.operation === operation)) return writeResult;
  const result = status.lastStagingTradePreview;
  return result?.offerId === offerId ? result : null;
}

function isMultiplayerStagingTradePending(operation = "", offerId = "") {
  if (!multiplayerStagingTradePending) return false;
  if (Date.now() - Number(multiplayerStagingTradePending.startedAt || 0) > 10000) {
    multiplayerStagingTradePending = null;
    return false;
  }
  return (!operation || multiplayerStagingTradePending.operation === operation) &&
    (!offerId || multiplayerStagingTradePending.offerId === offerId);
}

function getMultiplayerStagingTradeSyncLine(result) {
  if (!result?.applied) return "";
  const actionLabel = result.operation === "sell" ? "Server sell applied" : "Server buy applied";
  if (multiplayerStagingTradeSyncStatus?.receivedAt !== result.receivedAt) {
    return "Cloud save refresh pending.";
  }
  if (multiplayerStagingTradeSyncStatus.status === "synced") return "Trade complete and progress saved.";
  if (multiplayerStagingTradeSyncStatus.status === "syncing") return "Refreshing cloud save...";
  return `${actionLabel}. Reload or reopen to sync full save display.`;
}

function getMultiplayerStagingPlayerTradeStatusLine(offerId, operation = "buy") {
  const operationLabel = operation === "sell" ? "Sell" : "Buy";
  if (!offerId) {
    return `<div class="trade-preview-note staging-trade-status compact">No staging route available for this ${operation === "sell" ? "sale" : "purchase"}.</div>`;
  }
  return `<div class="trade-preview-note staging-trade-status compact">${operationLabel} applies to this pilot save immediately. Debug previews stay in the MP diagnostics panel.</div>`;
}

function getMultiplayerStagingTradeSellProfit(result) {
  const quantity = Math.max(0, Number(result?.quantity || Math.abs(result?.cargoDelta || 0)));
  const revenue = Math.max(0, Number(result?.revenue || result?.creditsDelta || 0));
  const basis = Number(result?.cargoCostBasisBefore);
  if (!quantity || !Number.isFinite(basis) || basis <= 0) return null;
  return revenue - (basis * quantity);
}

function showMultiplayerStagingTradeSellFeedback(result) {
  if (!result?.applied || result.operation !== "sell") return;
  const resource = result.resourceName || selectedMarketResource || "resource";
  const quantity = Math.max(0, Number(result.quantity || Math.abs(result.cargoDelta || 0)));
  const revenue = Math.max(0, Number(result.revenue || result.creditsDelta || 0));
  const planet = result.sellNode || getCurrentMarketPlanet();
  const profit = getMultiplayerStagingTradeSellProfit(result);
  const recovered = result.recoveredResourceSale === true || profit === null;

  if (typeof showTradeResultBurst === "function") {
    showTradeResultBurst({
      good: resource,
      quantity,
      revenue,
      profit: recovered ? revenue : profit,
      valueMode: recovered,
      title: recovered ? "Recovered Cargo Sold" : "Trade Complete",
      detail: recovered
        ? `Sold ${formatNumber(quantity)} ${resource} at ${planet}`
        : `Sold ${formatNumber(quantity)} ${resource} at ${planet}`
    });
  }

  if (typeof showTradeMiniFloat === "function") {
    showTradeMiniFloat({ profit: recovered ? revenue : profit });
  }

  if (typeof addActivityLog === "function") {
    const line = recovered
      ? `Sold ${formatNumber(quantity)} ${resource} at ${planet} for +CR ${formatNumber(revenue)}. Recovered resource sale.`
      : `Sold ${formatNumber(quantity)} ${resource} at ${planet} for ${profit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(profit))} profit.`;
    addActivityLog(line);
  }
}

function applyMultiplayerStagingTradeObjective(result) {
  if (!isMultiplayerStagingActive() || !result?.applied) return;
  if (result.operation === "buy") {
    const quantity = Math.max(0, Number(result.quantity || Math.abs(result.cargoDelta || 0)));
    const buyPrice = Math.max(1, Number(result.buyPrice || (quantity ? Math.abs(result.cost || result.totalCost || 0) / quantity : 0) || 1));
    const sellPrice = Math.max(buyPrice, Number(result.sellPrice || (quantity ? Math.abs(result.projectedRevenue || 0) / quantity : 0) || buyPrice));
    const route = {
      id: `staging-trade-${result.offerId || Date.now()}`,
      marketTrade: true,
      good: result.resourceName || selectedMarketResource,
      origin: result.buyNode || getCurrentMarketPlanet(),
      destination: result.sellNode || selectedMarketTargetPlanet,
      buyPrice,
      sellPrice,
      profitPerUnit: sellPrice - buyPrice,
      maxUnits: quantity,
      purchasedUnits: quantity,
      acceptedAtCycle: typeof getMarketCycle === "function" ? getMarketCycle() : null,
      status: "active"
    };
    setActiveTradeObjective(route);
    if (typeof addActivityLog === "function") {
      addActivityLog(`Trade route active: deliver ${formatNumber(quantity)} ${route.good} to ${route.destination}. Estimated profit CR ${formatNumber(Math.max(0, (sellPrice - buyPrice) * quantity))}.`);
    }
    if (typeof renderObjectiveHud === "function") renderObjectiveHud();
    return;
  }

  if (result.operation === "sell" && activeTradeRoute?.marketTrade && activeTradeRoute.good === result.resourceName) {
    const realizedProfit = Number(activeTradeRoute.realizedProfit || 0) + Math.max(0, Number(result.revenue || 0) - (Number(activeTradeRoute.buyPrice || 0) * Math.max(0, Number(result.quantity || 0))));
    updateActiveTradeProgress({
      realizedProfit,
      purchasedUnits: Math.max(0, Number(activeTradeRoute.purchasedUnits || 0) - Math.max(0, Number(result.quantity || 0))),
      status: "active"
    });
    if (currentNode === activeTradeRoute.destination && Number(cargo[result.resourceName] || 0) <= 0) {
      completeActiveTradeIfReady(result.resourceName);
    } else if (typeof renderObjectiveHud === "function") {
      renderObjectiveHud();
    }
  }
}

async function reconcileMultiplayerStagingTradeWrite(result) {
  if (!isMultiplayerStagingActive() || !result?.applied || !["buy", "sell"].includes(result.operation)) return;
  if (multiplayerStagingTradeLastHandledAt >= Number(result.receivedAt || 0)) return;
  multiplayerStagingTradeLastHandledAt = Number(result.receivedAt || Date.now());
  multiplayerStagingTradePending = null;
  multiplayerStagingTradeSyncStatus = {
    status: "syncing",
    receivedAt: result.receivedAt,
    reason: ""
  };

  const summary = result.operation === "buy"
    ? `Bought ${formatNumber(Math.abs(result.cargoDelta || result.quantity || 0))} ${result.resourceName || "cargo"} for CR ${formatNumber(Math.abs(result.creditsDelta || result.cost || 0))}.`
    : `Sold ${formatNumber(Math.abs(result.cargoDelta || result.quantity || 0))} ${result.resourceName || "cargo"} for CR ${formatNumber(Math.abs(result.creditsDelta || result.revenue || 0))}.`;
  if (typeof addHudToast === "function") addHudToast(summary);
  if (result.operation === "buy" && typeof addActivityLog === "function") addActivityLog(summary);
  if (result.operation === "sell") showMultiplayerStagingTradeSellFeedback(result);

  const resourceName = String(result.resourceName || "");
  if (Number.isFinite(Number(result.creditsAfter))) credits = Math.max(0, Number(result.creditsAfter));
  if (resourceName && Object.prototype.hasOwnProperty.call(cargo, resourceName) && Number.isFinite(Number(result.cargoAfter))) {
    cargo[resourceName] = Math.max(0, Number(result.cargoAfter));
    const quantity = Math.max(0, Number(result.quantity || Math.abs(result.cargoDelta || 0)));
    if (result.operation === "buy") {
      cargoPurchased[resourceName] = Math.max(0, Number(cargoPurchased?.[resourceName] || 0)) + quantity;
    } else {
      playerProgress = normalizePlayerProgress(playerProgress);
      playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + quantity;
      cargoPurchased[resourceName] = Math.max(0, Number(cargoPurchased?.[resourceName] || 0) - quantity);
      if (cargoPurchased[resourceName] <= 0) delete cargoPurchased[resourceName];
    }
    if (Number.isFinite(Number(result.cargoCostBasisAfter)) && Number(result.cargoCostBasisAfter) > 0) {
      cargoCostBasis[resourceName] = Number(result.cargoCostBasisAfter);
    } else {
      delete cargoCostBasis[resourceName];
    }
  }
  applyMultiplayerStagingTradeObjective(result);
  multiplayerStagingTradeSyncStatus = {
    status: "synced",
    receivedAt: result.receivedAt,
    reason: "trusted trade result applied"
  };
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  if (document.getElementById("marketScreen")?.classList.contains("active")) renderMarketplace();
}

function renderMultiplayerStagingTradePreviewResult(offerId, { operation = "buy" } = {}) {
  if (!isMultiplayerStagingActive()) return "";
  const debugMode = isMultiplayerStagingDebugActive();
  if (!debugMode) return getMultiplayerStagingPlayerTradeStatusLine(offerId, operation);

  const result = getLastMatchingMultiplayerStagingTradePreview(offerId, operation);
  const operationLabel = operation === "sell" ? "sell" : "buy";
  if (!offerId) {
    return `<div class="trade-preview-note staging-trade-status compact">Debug ${operationLabel} preview unavailable for this route.</div>`;
  }
  if (!result) {
    return `<div class="trade-preview-note staging-trade-status compact">Debug ${operationLabel} preview ready.</div>`;
  }

  const debugLine = debugMode
    ? `<span>${result.validationMode || "unknown"} / trusted ${result.trustedStateAvailable ? "yes" : "no"} / snapshot ${result.snapshotUsed ? "yes" : "no"}</span>`
    : "";
  const applied = result.applied === true && result.mode === "trade_write";
  const resultOperation = result.operation || operationLabel;
  const resultTitle = applied ? `MP staging: server ${resultOperation} applied` : "MP staging: server preview only";
  const writeLine = applied
    ? `<span>Staging ${resultOperation} applied: CR ${formatNumber(result.creditsBefore)} -> ${formatNumber(result.creditsAfter)} (${result.creditsDelta < 0 ? "-" : "+"}${formatNumber(Math.abs(result.creditsDelta))})</span>
      <span>${result.resourceName || "Cargo"} ${formatNumber(result.cargoBefore)} -> ${formatNumber(result.cargoAfter)} / hold ${formatNumber(result.cargoUsedBefore)} -> ${formatNumber(result.cargoUsedAfter)} of ${formatNumber(result.cargoCapacity)}</span>
      <span>${getMultiplayerStagingTradeSyncLine(result)}</span>`
    : `${getMultiplayerStagingTradeWriteBlockLine(result)}
      <span>Dry run only - no credits, cargo, saves, inventory, bounties, loot, or economy changed.</span>`;

  return `
    <div class="trade-preview-note staging-trade-status detailed">
      <strong>${resultTitle}</strong>
      <span>${resultOperation.toUpperCase()} ${applied ? "write" : "dry-run"} / Cost CR ${formatNumber(result.totalCost ?? result.cost)} / Revenue CR ${formatNumber(result.projectedRevenue ?? result.revenue)} / Profit ${(result.projectedProfit ?? result.profitPreview) >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(result.projectedProfit ?? result.profitPreview))}</span>
      <span>${getMultiplayerStagingTradeValidationLabel(result)}</span>
      <span>${getMultiplayerStagingTradeSourceLabel(result)}</span>
      ${debugLine}
      ${writeLine}
    </div>
  `;
}

function requestMultiplayerStagingTradeDryRun({ operation = "buy", offerId = "", quantity = 1 } = {}) {
  if (!isMultiplayerStagingActive()) return false;
  if (!isMultiplayerStagingTradeReady()) {
    const message = "The trade network is still connecting.";
    if (typeof addHudToast === "function") addHudToast(message);
    if (typeof addActivityLog === "function") addActivityLog(message);
    requestMultiplayerStagingTradeOffersIfNeeded();
    return true;
  }
  if (!offerId) {
    const message = "This route is not available yet.";
    if (typeof addHudToast === "function") addHudToast(message);
    if (typeof addActivityLog === "function") addActivityLog(message);
    return true;
  }
  if (isMultiplayerStagingTradePending(operation, offerId)) {
    if (typeof addHudToast === "function") addHudToast("Server trade request already pending.");
    return true;
  }

  multiplayerStagingTradePending = {
    operation,
    offerId,
    quantity,
    startedAt: Date.now()
  };
  let sent = false;
  if (operation === "sell" && typeof window.LupenMultiplayerClient.stagingTradeSell === "function") {
    sent = window.LupenMultiplayerClient.stagingTradeSell({ offerId, quantity });
  } else if (typeof window.LupenMultiplayerClient.stagingTradeBuy === "function") {
    sent = window.LupenMultiplayerClient.stagingTradeBuy({ offerId, quantity });
  } else {
    sent = window.LupenMultiplayerClient.requestStagingTradePreview({ offerId, quantity });
  }
  if (!sent || sent.ok === false) {
    multiplayerStagingTradePending = null;
    if (typeof addHudToast === "function") addHudToast("The trade request could not be sent.");
    return true;
  }
  if (typeof addHudToast === "function") addHudToast(operation === "sell" ? "Processing sale." : "Processing purchase.");
  window.setTimeout(() => {
    if (document.getElementById("marketScreen")?.classList.contains("active")) renderMarketplace();
  }, 350);
  return true;
}

function setupMultiplayerStagingTradeTerminalSubscription() {
  if (!isMultiplayerStagingActive()) return;
  if (window.__lupenStagingTradeTerminalSubscribed) return;
  const client = window.LupenMultiplayerClient;
  if (!client?.onServerState) return;

  const subscription = client.onServerState(() => {
    const result = getMultiplayerStagingTradeStatus().lastStagingTradeWriteResult;
    if (result?.receivedAt && multiplayerStagingTradePending &&
      result.operation === multiplayerStagingTradePending.operation &&
      result.offerId === multiplayerStagingTradePending.offerId) {
      multiplayerStagingTradePending = null;
    }
    reconcileMultiplayerStagingTradeWrite(result);
    if (document.getElementById("marketScreen")?.classList.contains("active")) {
      renderMarketplace();
    }
  });
  window.__lupenStagingTradeTerminalSubscribed = subscription;
}

function renderNpcItemBroker() {
  const broker = document.getElementById("npcItemBroker");
  if (!broker) return;

  const groupedItems = groupInventoryItems(inventoryItems);

  if (!groupedItems.length) {
    broker.innerHTML = `<div class="broker-empty">No looted items to sell.</div>`;
    return;
  }

  broker.innerHTML = groupedItems.map(item => {
    const unitValue = getInventoryItemSellValue(item.key, item.quality);
    const stackValue = unitValue * item.count;

    return `
      <div class="broker-item-card quality-${item.quality}">
        <div class="broker-item-frame quality-${item.quality}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="broker-item-info">
          <strong>${item.name}</strong>
          <span>${titleCaseQuality(item.quality)} / ${item.category}</span>
        </div>
        <div class="broker-item-stack">x${formatNumber(item.count)}</div>
        <div class="broker-item-value">
          <span>Each</span>
          <strong><span class="mini-credit">CR</span>${formatNumber(unitValue)}</strong>
        </div>
        <div class="broker-item-actions">
          <button onclick="sellInventoryItemToNpc('${escapeJsString(item.key)}', '${escapeJsString(item.quality)}', 1)">Sell 1</button>
          <button onclick="sellInventoryItemToNpc('${escapeJsString(item.key)}', '${escapeJsString(item.quality)}', 'all')">Sell Stack / CR ${formatNumber(stackValue)}</button>
        </div>
      </div>
    `;
  }).join("");
}

function sellInventoryItemToNpc(key, quality, amount = "all", refreshStore = false) {
  const matchingCount = inventoryItems.filter(item => item.key === key && item.quality === quality).length;
  if (!matchingCount) return;

  const quantity = amount === "all" ? matchingCount : Math.min(Number(amount) || 0, matchingCount);
  if (quantity <= 0) return;

  const removed = removeInventoryItems(key, quality, quantity);
  if (!removed) return;

  const unitValue = getInventoryItemSellValue(key, quality);
  credits += unitValue * removed;

  saveGame();
  if (refreshStore) {
    renderStore();
  } else {
    renderMarketplace();
  }
  updateHudDock();
}


function getLegacyMarketCycle() {
  return Math.floor(Date.now() / 600000);
}

function getLegacyNextMarketRefreshSeconds() {
  return Math.max(0, 600 - Math.floor((Date.now() % 600000) / 1000));
}

function updateLegacyTradeTimerDisplay() {
  const cycleText = document.getElementById("marketCycleText");
  if (!cycleText) return;

  const seconds = getNextMarketRefreshSeconds();
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  cycleText.textContent = `Prices refresh in: ${minutes}:${remainder}`;
}

function startTradeTerminalTimer() {
  stopTradeTerminalTimer();
  renderedMarketCycle = getMarketCycle();
  tradeTerminalTimer = setInterval(() => {
    updateTradeTimerDisplay();

    const cycle = getMarketCycle();
    if (cycle !== renderedMarketCycle && document.getElementById("marketScreen")?.classList.contains("active")) {
      renderedMarketCycle = cycle;
      updateTradeTimerDisplay();
    }
  }, 1000);
}

function stopTradeTerminalTimer() {
  if (tradeTerminalTimer) {
    clearInterval(tradeTerminalTimer);
    tradeTerminalTimer = null;
  }
}

function getCommodityRarityClass(good) {
  const rarity = (commodityInfo[good]?.rarity || "common").toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `rarity-${rarity}`;
}

function marketHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDynamicMarketPrices(location = currentNode) {
  const baseMarket = planetMarkets[location] || planetMarkets["Asteron Prime"];
  const cycle = getMarketCycle();
  const prices = {};

  mineralKeys.forEach(good => {
    const base = baseMarket[good] || 1;
    const hash = marketHash(`${cycle}:${location}:${good}`);
    const swing = ((hash % 31) - 15) / 100; // -15% to +15%
    prices[good] = Math.max(1, Math.round(base * (1 + swing)));
  });

  return prices;
}

function getLegacyMapOneMarketPrice(good, planet) {
  return planetMarkets[planet]?.[good] || 0;
}

function getCurrentMarketPlanet() {
  if (MAP_ONE_MARKET_PLANETS.includes(currentNode)) return currentNode;
  if (MAP_ONE_MARKET_PLANETS.includes(lastPlanetNode)) return lastPlanetNode;
  return "Asteron Prime";
}

function getOrderedMapOneMarketPlanets(currentPlanet = getCurrentMarketPlanet()) {
  if (!MAP_ONE_MARKET_PLANETS.includes(currentPlanet)) return MAP_ONE_MARKET_PLANETS;
  return [currentPlanet, ...MAP_ONE_MARKET_PLANETS.filter(planet => planet !== currentPlanet)];
}

function getJumpCountBetweenNodes(fromNodeId, toNodeId) {
  if (!fromNodeId || !toNodeId || !sectorNodes[fromNodeId] || !sectorNodes[toNodeId]) return null;
  const path = typeof findSectorRoute === "function" ? findSectorRoute(fromNodeId, toNodeId) : [];
  if (fromNodeId === toNodeId) return 0;
  if (path.length <= 1) return null;
  const sectorHops = path.length - 1;
  if (MAP_ONE_MARKET_PLANETS.includes(fromNodeId) && MAP_ONE_MARKET_PLANETS.includes(toNodeId)) {
    return Math.max(1, Math.ceil(sectorHops / 3));
  }
  return sectorHops;
}

function getTradeRouteMarginLabel(unitMargin, buyPrice) {
  if (unitMargin <= 0 || buyPrice <= 0) return "Loss";
  const marginPercent = (unitMargin / buyPrice) * 100;
  if (marginPercent < 10) return "Weak Margin";
  if (marginPercent < 20) return "Fair Margin";
  return "Strong Margin";
}

function getTradeRouteHint(route) {
  if (!route) return "";
  if (route.unitMargin <= 0) return route.jumpCount === 1 ? "Short route, poor return" : "Longer route, poor return";
  if (route.marginPercent >= 20 && (route.jumpCount || 0) > 1) return "Longer route, stronger return";
  if (route.marginPercent >= 20) return "Strong return from this station";
  if (route.marginPercent >= 10) return "Balanced route, steady return";
  return "Small margin, watch the cargo cost";
}

function getMarketPlanetImage(planet) {
  if (planet === "Virella") return "assets/planets/virella.png";
  if (planet === "Nyxara") return "assets/planets/nyxara.png";
  if (planet === "Asteron Prime") return "assets/planets/asteron-prime.png";
  return "";
}

function getMarketRouteCards({
  resource = selectedMarketResource,
  origin = getCurrentMarketPlanet(),
  stagingTradeLocked = isMultiplayerStagingActive() && !isLocalTutorialTradeActive()
} = {}) {
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const destinations = MAP_ONE_MARKET_PLANETS.filter(planet => planet !== origin);
  const routes = destinations.map(destination => {
    const stagingOffer = stagingTradeLocked
      ? findMultiplayerStagingTradeOffer({ good: resource, origin, destination })
      : null;
    const stagingPricing = stagingTradeLocked
      ? getMultiplayerStagingRoutePricing({ good: resource, origin, destination })
      : null;
    const buyPrice = stagingTradeLocked ? Number(stagingPricing?.buyPrice || stagingOffer?.buyPrice || 0) : getMapOneMarketPrice(resource, origin);
    const sellPrice = stagingTradeLocked ? Number(stagingPricing?.sellPrice || stagingOffer?.sellPrice || 0) : getMapOneMarketPrice(resource, destination);
    const routeLimit = stagingTradeLocked
      ? getMultiplayerStagingTradeQuantityLimit({ operation: "buy", good: resource, origin, destination })
      : getMarketMaxBuyQuantity(resource, origin);
    const affordable = buyPrice > 0 ? Math.floor(credits / buyPrice) : 0;
    const maxUnits = Math.max(0, Math.min(routeLimit, affordable, freeCargo));
    const selectedUnits = maxUnits;
    const unitMargin = sellPrice - buyPrice;
    const marginPercent = buyPrice > 0 ? (unitMargin / buyPrice) * 100 : 0;
    const estimatedProfit = unitMargin * selectedUnits;
    const jumpCount = getJumpCountBetweenNodes(origin, destination);
    const jumpPenalty = jumpCount === null ? 0 : jumpCount * 25;
    const pending = stagingTradeLocked && stagingOffer && isMultiplayerStagingTradePending("buy", stagingOffer.offerId);
    const score = estimatedProfit - jumpPenalty;

    return {
      destination,
      origin,
      resource,
      buyPrice,
      sellPrice,
      unitMargin,
      marginPercent,
      marginLabel: getTradeRouteMarginLabel(unitMargin, buyPrice),
      maxUnits,
      selectedUnits,
      totalCost: buyPrice * selectedUnits,
      estimatedRevenue: sellPrice * selectedUnits,
      estimatedProfit,
      jumpCount,
      score,
      stagingOffer,
      pending,
      isLoss: unitMargin <= 0,
      canLoad: estimatedProfit > 0 && unitMargin > 0 && selectedUnits > 0 && buyPrice > 0 && credits >= buyPrice * selectedUnits && freeCargo >= selectedUnits && (!stagingTradeLocked || Boolean(stagingOffer)) && !pending
    };
  });

  routes.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.estimatedProfit !== left.estimatedProfit) return right.estimatedProfit - left.estimatedProfit;
    if (right.unitMargin !== left.unitMargin) return right.unitMargin - left.unitMargin;
    return left.destination.localeCompare(right.destination);
  });

  const bestRoute = routes.find(route => route.unitMargin > 0 && route.estimatedProfit > 0);
  if (bestRoute) bestRoute.isBest = true;
  return routes;
}

function renderTradeRouteCard(route) {
  const destinationClass = safeId(route.destination);
  const planetImage = getMarketPlanetImage(route.destination);
  const jumpsText = route.jumpCount === null ? "? Jumps" : `${formatNumber(route.jumpCount)} ${route.jumpCount === 1 ? "Jump" : "Jumps"}`;
  const profitClass = route.estimatedProfit >= 0 ? "profit-good" : "profit-bad";
  const profitSign = route.estimatedProfit >= 0 ? "+" : "-";
  const buttonLabel = route.pending ? "Applying..." : "Accept Trade";
  const disabledAttr = route.canLoad ? "" : "disabled";
  const badge = route.isBest
    ? `<span class="trade-route-badge">BEST ROUTE</span>`
    : "";
  const cardClasses = [
    "trade-route-card",
    route.isBest ? "is-best" : "",
    route.isLoss ? "is-loss is-muted" : "",
    selectedMarketTargetPlanet === route.destination ? "is-selected" : ""
  ].filter(Boolean).join(" ");

  return `
    <article
      class="${cardClasses}"
      data-route-destination="${escapeHtml(route.destination)}"
      data-tutorial-target="${route.destination === selectedMarketTargetPlanet ? "marketRouteCard" : ""}"
      onclick="selectMarketRouteDestination('${escapeJsString(route.destination)}')"
      onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMarketRouteDestination('${escapeJsString(route.destination)}'); }"
      tabindex="0"
      role="button"
      aria-label="${escapeHtml(`${route.resource} route from ${route.origin} to ${route.destination}`)}">
      <div class="trade-route-card__planet trade-route-card__planet--${destinationClass}" aria-hidden="true">
        ${planetImage ? `<img src="${escapeHtml(planetImage)}" alt="">` : ""}
      </div>
      <div class="trade-route-card__main">
        <div class="trade-route-card__title-row">
          <div>
            <h4 class="trade-route-card__title">${escapeHtml(route.destination)}</h4>
            <p class="trade-route-card__route">${escapeHtml(route.origin)} -> ${escapeHtml(route.destination)}</p>
          </div>
          ${badge}
        </div>
        <div class="trade-route-card__chips">
          <span class="trade-route-chip trade-route-chip--sell">Sell CR ${formatNumber(route.sellPrice)}</span>
          <span class="trade-route-chip trade-route-chip--jumps">${jumpsText}</span>
          <span class="trade-route-chip ${route.isLoss ? "trade-route-chip--loss" : "trade-route-chip--profit"}">${escapeHtml(route.marginLabel)}</span>
        </div>
        <div class="trade-route-card__bottom">
          <div class="trade-route-card__profit">
            <span>Estimated Profit</span>
            <strong class="${profitClass}">${profitSign}CR ${formatNumber(Math.abs(route.estimatedProfit))}</strong>
            <em>${escapeHtml(getTradeRouteHint(route))}</em>
          </div>
          <div class="trade-route-card__cargo">
            <span>Cargo:</span>
            <strong>${formatNumber(route.selectedUnits)} units</strong>
            <em>Maximum affordable cargo will be loaded automatically.</em>
          </div>
          <button
            type="button"
            class="trade-route-card__button trade-primary-action"
            data-tutorial-target="${route.destination === selectedMarketTargetPlanet ? "buyCargo" : ""}"
            onclick="loadMarketRouteCargo('${escapeJsString(route.destination)}', event)"
            ${disabledAttr}>${buttonLabel}</button>
        </div>
      </div>
    </article>
  `;
}

function renderTradeRouteCards(routes) {
  const profitableRoutes = routes.filter(route => route.estimatedProfit > 0 && route.unitMargin > 0 && route.selectedUnits > 0);
  if (!profitableRoutes.length) {
    return `<div class="trade-route-empty">
      <strong>No profitable route available for this resource.</strong>
      <span>Select another resource or wait for the next market refresh.</span>
    </div>`;
  }
  return `<div class="trade-route-list">${profitableRoutes.map(renderTradeRouteCard).join("")}</div>`;
}

function normalizeMarketBuilderState() {
  const currentPlanet = getCurrentMarketPlanet();
  const tutorialTradeActive = isLocalTutorialTradeActive();
  if (isMultiplayerStagingActive() && !tutorialTradeActive) requestMultiplayerStagingTradeOffersIfNeeded();
  const localRouteSellReady = getLocalRouteSellReadyState(currentPlanet);

  if (!MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource)) {
    selectedMarketResource = "Crystal Shards";
  }

  if (localRouteSellReady.ready) {
    selectedMarketResource = localRouteSellReady.good;
    selectedMarketTargetPlanet = currentPlanet;
  } else if (isMultiplayerStagingActive() && !tutorialTradeActive && getMultiplayerStagingTradeOffers().length) {
    const sellableCargo = getMultiplayerStagingSellableCargoAt(currentPlanet);
    if (!canSelectMultiplayerStagingMarketResource(selectedMarketResource, currentPlanet)) {
      selectedMarketResource = sellableCargo[0] || getMultiplayerStagingBuyOffersAt(currentPlanet)[0]?.resourceName || selectedMarketResource;
    }
    const selectedSellOffer = sellableCargo.includes(selectedMarketResource)
      ? findMultiplayerStagingSellOffer({ good: selectedMarketResource, destination: currentPlanet })
      : null;
    const stagingTargets = selectedSellOffer ? [currentPlanet] : getMultiplayerStagingTargetPlanetsForResource(selectedMarketResource, currentPlanet);
    if (selectedSellOffer) {
      selectedMarketTargetPlanet = currentPlanet;
    } else if (stagingTargets.length && (!stagingTargets.includes(selectedMarketTargetPlanet) || selectedMarketTargetPlanet === currentPlanet)) {
      selectedMarketTargetPlanet = getBestMultiplayerStagingTargetPlanet(selectedMarketResource, currentPlanet) || stagingTargets[0];
    }
  } else if (activeTradeRoute?.marketTrade && activeTradeRoute.good === selectedMarketResource && MAP_ONE_MARKET_PLANETS.includes(activeTradeRoute.destination)) {
    selectedMarketTargetPlanet = activeTradeRoute.destination;
  } else if (!MAP_ONE_MARKET_PLANETS.includes(selectedMarketTargetPlanet) || selectedMarketTargetPlanet === currentPlanet) {
    selectedMarketTargetPlanet = MAP_ONE_MARKET_PLANETS.find(planet => planet !== currentPlanet) || "Nyxara";
  }

  const stagingSellOffer = isMultiplayerStagingActive() && !tutorialTradeActive && Number(cargo[selectedMarketResource] || 0) > 0
    ? findMultiplayerStagingSellOffer({ good: selectedMarketResource, destination: currentPlanet })
    : null;
  const maxBuy = getMarketMaxBuyQuantity(selectedMarketResource, currentPlanet);
  const maxQuantity = isMultiplayerStagingActive() && !tutorialTradeActive
    ? getMultiplayerStagingTradeQuantityLimit({
      operation: stagingSellOffer ? "sell" : "buy",
      good: selectedMarketResource,
      origin: currentPlanet,
      destination: selectedMarketTargetPlanet
    })
    : Math.max(1, maxBuy || getShipStats().cargo || 1);
  selectedMarketQuantity = localRouteSellReady.ready
    ? Math.max(1, Number(cargo[localRouteSellReady.good] || 0))
    : stagingSellOffer
    ? Math.max(1, maxQuantity)
    : clampNumber(selectedMarketQuantity || 1, 1, Math.max(1, maxQuantity));
}

function getLocalRouteSellReadyState(currentPlanet = getCurrentMarketPlanet()) {
  const route = syncActiveTradeObjective();
  if (!route?.marketTrade || !route.good) {
    return { ready: false, route: null, good: "", held: 0 };
  }
  const held = Math.max(0, Number(cargo?.[route.good] || 0));
  const ready = held > 0 && currentPlanet === route.destination;
  return {
    ready,
    route,
    good: route.good,
    held
  };
}

function getMarketMaxBuyQuantity(good = selectedMarketResource, planet = getCurrentMarketPlanet()) {
  const price = getMapOneMarketPrice(good, planet);
  const maxAffordable = price > 0 ? Math.floor(credits / price) : 0;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  return Math.max(0, Math.min(maxAffordable, freeCargo));
}

function getCommodityBuyPrice(good, location = currentNode) {
  return getDynamicMarketPrices(location)[good] || 1;
}

function getCommoditySellPrice(good, location = currentNode) {
  return getCommodityBuyPrice(good, location);
}

function getActiveTradePricing(good) {
  const objective = syncActiveTradeObjective();
  if (objective?.type === "trade" && objective.good === good) return objective;
  return null;
}

function getEffectiveBuyPrice(good, location = currentNode) {
  const route = getActiveTradePricing(good);
  if (route && route.origin === location) {
    return route.buyPrice;
  }
  return getCommodityBuyPrice(good, location);
}

function getEffectiveSellPrice(good, location = currentNode) {
  const route = getActiveTradePricing(good);
  if (route && route.destination === location) {
    return route.sellPrice;
  }
  return getCommoditySellPrice(good, location);
}

function setLegacyTradeTerminalTab(tabName) {
  activeTradeTerminalTab = "market";
  renderMarketplace();
}

function renderLegacyMarketplace() {
  setupMultiplayerStagingTradeTerminalSubscription();
  requestMultiplayerStagingTradeOffersIfNeeded();

  const market = getDynamicMarketPrices(currentNode);
  const stock = marketStock[currentNode] || marketStock[lastPlanetNode] || marketStock["Asteron Prime"];
  const goodsBox = document.getElementById("marketGoods");

  document.getElementById("marketLocationTitle").textContent = currentNode.toUpperCase();
  document.getElementById("creditsText").textContent = formatNumber(credits);
  document.getElementById("cargoText").textContent = `${formatNumber(cargoUsed())} / ${formatNumber(getShipStats().cargo)}`;

  const flavor = document.getElementById("marketFlavorText");
  if (flavor) {
    flavor.textContent = getMarketFlavorText(currentNode);
  }

  renderedMarketCycle = getMarketCycle();
  updateTradeTimerDisplay();
  renderMarketCargoSummary();

  if (!goodsBox) return;
  goodsBox.innerHTML = "";

  const listHeaderLabel = document.querySelector(".phase-one-market-header span:first-child");
  if (listHeaderLabel) {
    listHeaderLabel.textContent = "Market Board";
  }
  renderMapOneMarketTerminal(goodsBox);
}

function renderMapOneMarketTerminal(goodsBox) {
  normalizeMarketBuilderState();

  const tutorialTradeActive = isLocalTutorialTradeActive();
  const stagingTradeLocked = isMultiplayerStagingActive() && !tutorialTradeActive;
  const currentPlanet = getCurrentMarketPlanet();
  const localRouteSellReady = getLocalRouteSellReadyState(currentPlanet);
  const orderedMarketPlanets = getOrderedMapOneMarketPlanets(currentPlanet);
  const resource = selectedMarketResource;
  const targetPlanet = selectedMarketTargetPlanet;
  const activeMarketTrade = activeTradeRoute?.marketTrade && activeTradeRoute.good === resource
    ? activeTradeRoute
    : null;
  const held = cargo[resource] || 0;
  const sellStagingOffer = stagingTradeLocked && held > 0
    ? findMultiplayerStagingSellOffer({ good: resource, destination: currentPlanet })
    : null;
  const cargoUnitBasis = getCargoCostBasisForResource(resource);
  const stagingRecoveredCargoSale = Boolean(stagingTradeLocked && sellStagingOffer && cargoUnitBasis === null);
  const sellStagingOrigin = stagingRecoveredCargoSale ? "" : sellStagingOffer?.buyNode || currentPlanet;
  const stagingSellMode = Boolean(stagingTradeLocked && sellStagingOffer);
  const localSellMode = Boolean(localRouteSellReady.ready && localRouteSellReady.good === resource);
  const sellMode = stagingSellMode || localSellMode;
  const stagingTargetPlanets = stagingTradeLocked && getMultiplayerStagingTradeOffers().length
    ? (stagingSellMode ? [currentPlanet] : getMultiplayerStagingTargetPlanetsForResource(resource, currentPlanet))
    : [];
  const targetPlanetOptions = stagingTradeLocked && stagingTargetPlanets.length
    ? stagingTargetPlanets
    : MAP_ONE_MARKET_PLANETS.filter(planet => planet !== currentPlanet || planet === targetPlanet);
  const buyStagingOffer = stagingTradeLocked
    ? findMultiplayerStagingTradeOffer({ good: resource, origin: currentPlanet, destination: targetPlanet })
    : null;
  const stagingRoutePricing = stagingTradeLocked
    ? getMultiplayerStagingRoutePricing({ good: resource, origin: currentPlanet, destination: targetPlanet })
    : null;
  const quantity = selectedMarketQuantity;
  const buyPrice = stagingTradeLocked ? Number(stagingRoutePricing?.buyPrice || 0) : getMapOneMarketPrice(resource, currentPlanet);
  const estimatedSellPrice = stagingTradeLocked ? Number(stagingRoutePricing?.sellPrice || 0) : getMapOneMarketPrice(resource, targetPlanet);
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const atTargetWithCargo = held > 0 && currentPlanet === targetPlanet;
  const maxBuy = stagingTradeLocked && buyStagingOffer
    ? getMultiplayerStagingMaxBuyQuantity({ good: resource, origin: currentPlanet, destination: targetPlanet })
    : getMarketMaxBuyQuantity(resource, currentPlanet);
  const buyQuantityLimit = stagingTradeLocked
    ? getMultiplayerStagingTradeQuantityLimit({ operation: "buy", good: resource, origin: currentPlanet, destination: targetPlanet })
    : Math.max(1, maxBuy);
  const sellQuantityLimit = localSellMode
    ? held
    : stagingSellMode
    ? getMultiplayerStagingTradeQuantityLimit({ operation: "sell", good: resource, origin: currentPlanet, destination: currentPlanet })
    : 1;
  const effectiveQuantity = sellMode
    ? clampNumber(quantity || 1, 1, Math.max(1, sellQuantityLimit))
    : clampNumber(quantity || 1, 1, Math.max(1, stagingTradeLocked ? buyQuantityLimit : maxBuy));
  const totalCost = buyPrice * effectiveQuantity;
  const estimatedRevenue = estimatedSellPrice * effectiveQuantity;
  const estimatedProfit = estimatedRevenue - totalCost;
  const profitMargin = totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
  const cargoSpaceUsed = effectiveQuantity;
  const buyPending = stagingTradeLocked && buyStagingOffer && isMultiplayerStagingTradePending("buy", buyStagingOffer.offerId);
  const sellPending = stagingTradeLocked && sellStagingOffer && isMultiplayerStagingTradePending("sell", sellStagingOffer.offerId);
  const canBuy = !stagingTradeLocked && effectiveQuantity > 0 && buyPrice > 0 && credits >= totalCost && freeCargo >= cargoSpaceUsed;
  const info = commodityInfo[resource] || {};
  const stagingTradeNotice = stagingTradeLocked
    ? renderMultiplayerStagingTradePreviewResult((stagingSellMode ? sellStagingOffer?.offerId : buyStagingOffer?.offerId) || "", { operation: stagingSellMode ? "sell" : "buy" })
    : "";
  const sellUnitPrice = stagingTradeLocked && sellStagingOffer ? sellStagingOffer.sellPrice : getEffectiveSellPrice(resource, currentPlanet);
  const sellUnitBasis = cargoUnitBasis || (stagingTradeLocked && sellStagingOffer && !stagingRecoveredCargoSale ? sellStagingOffer.buyPrice : getEffectiveBuyPrice(resource, currentPlanet)) || sellUnitPrice;
  const sellRevenue = Math.max(0, effectiveQuantity) * Math.max(0, sellUnitPrice || 0);
  const sellProfit = stagingRecoveredCargoSale
    ? sellRevenue
    : Math.max(0, effectiveQuantity) * ((sellUnitPrice || 0) - (sellUnitBasis || 0));
  const buyActionQuantityLimit = stagingTradeLocked ? buyQuantityLimit : maxBuy;
  const routeCards = sellMode ? [] : getMarketRouteCards({ resource, origin: currentPlanet, quantity: effectiveQuantity, stagingTradeLocked });
  const profitableRouteCards = routeCards.filter(route => route.estimatedProfit > 0 && route.unitMargin > 0 && route.selectedUnits > 0);
  const routeSectionLabel = profitableRouteCards.length === 1 ? "BEST ROUTE" : "AVAILABLE ROUTES";
  const selectedRouteCard = routeCards.find(route => route.destination === targetPlanet) || routeCards[0] || null;
  const selectedResourceBuyPrice = sellMode
    ? sellUnitBasis
    : selectedRouteCard?.buyPrice || (stagingTradeLocked ? getMultiplayerStagingMarketPrice(resource, currentPlanet, currentPlanet) : getMapOneMarketPrice(resource, currentPlanet)) || 0;
  const builderRouteText = sellMode
    ? (localSellMode ? `${activeMarketTrade?.origin || "Route origin"} > ${currentPlanet}` : stagingRecoveredCargoSale ? "Recovered resource" : `${sellStagingOrigin} > ${currentPlanet}`)
    : `Current station: ${currentPlanet}`;
  const sellOrigin = localSellMode ? activeMarketTrade?.origin || "Route origin" : sellStagingOrigin;

  goodsBox.innerHTML = `
    <div class="map-one-market-terminal">
      <div class="market-board-panel">
        <div class="market-board-table-wrap">
          <table class="market-board-table">
            <thead>
              <tr>
                <th>Resource</th>
                ${orderedMarketPlanets.map(planet => `<th>${planet}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${MAP_ONE_TRADE_RESOURCES.map(good => {
                const rowInfo = commodityInfo[good] || {};
                const stagingResourceSupported = canSelectMultiplayerStagingMarketResource(good, currentPlanet);
                return `
                  <tr
                    class="${good === resource ? "selected-market-row" : ""} ${stagingTradeLocked && !stagingResourceSupported ? "route-preview-only" : ""}"
                    data-tutorial-target="${good === "Iron" ? "marketResourceIron" : ""}"
                    onclick="setMarketResource('${escapeJsString(good)}')">
                    <td>
                      <div class="market-resource-cell">
                        <span class="commodity-icon market-board-icon">
                          <img src="${rowInfo.icon || getCommodityImage(good)}" alt="${good}" class="commodity-icon-img">
                        </span>
                        <strong>${good}</strong>
                      </div>
                    </td>
                    ${orderedMarketPlanets.map(planet => `
                      <td class="${planet === currentPlanet ? "current-market-planet" : ""}">
                        ${stagingTradeLocked
                          ? (getMultiplayerStagingMarketPrice(good, planet, currentPlanet) === null
                            ? "—"
                            : `CR ${formatNumber(getMultiplayerStagingMarketPrice(good, planet, currentPlanet))}`)
                          : `CR ${formatNumber(getMapOneMarketPrice(good, planet))}`}
                      </td>
                    `).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <aside class="market-builder-panel ${getCommodityRarityClass(resource)} ${sellMode ? "staging-sell-builder route-sell-builder" : ""}">
        <div class="trade-panel-kicker">Trade Builder</div>
        <div class="market-builder-selected">
          <span class="commodity-icon market-builder-icon">
            <img src="${info.icon || getCommodityImage(resource)}" alt="${resource}" class="commodity-icon-img">
          </span>
          <div>
            <h3>${resource}</h3>
            <p>${builderRouteText}</p>
            ${sellMode ? "" : `<p>Buy price: CR ${formatNumber(selectedResourceBuyPrice)}</p>`}
          </div>
        </div>

        <div class="market-builder-controls ${sellMode ? "" : "market-builder-controls--routes"}">
          ${sellMode ? `
          <div class="trade-preview-note staging-sell-summary route-sell-summary">
            <strong>${formatNumber(held)} ${resource} ready for sale</strong>
            <span>${sellOrigin} to ${currentPlanet} / CR ${formatNumber(sellUnitPrice)} per unit</span>
          </div>
          ` : `<div class="trade-route-section">
            <div class="trade-route-section__head">${routeSectionLabel}</div>
            ${renderTradeRouteCards(routeCards)}
          </div>`}
          ${sellMode ? `<label>
            <span>${sellMode ? "Sell Amount" : "Buy Amount"}</span>
            <div class="market-amount-control ${sellMode ? "" : "market-amount-control--route"}">
              <strong>${sellMode ? `Sell ${formatNumber(effectiveQuantity)} of ${formatNumber(held)} carried` : `${formatNumber(effectiveQuantity)} units`}</strong>
              ${sellMode
                ? `<button type="button" data-tutorial-target="marketMaxAmount" onclick="setMarketQuantityMax()" ${sellQuantityLimit <= 0 ? "disabled" : ""}>MAX</button>
                  <button class="trade-primary-action" data-tutorial-target="sellCargo" onclick="sellMarketCargo()" ${localSellMode || (sellStagingOffer && !sellPending) ? "" : "disabled"}>${sellPending ? "Applying..." : "Sell Cargo"}</button>`
                : `<button type="button" data-tutorial-target="marketMaxAmount" onclick="setMarketQuantityMax()" ${buyActionQuantityLimit <= 0 ? "disabled" : ""}>MAX</button>`}
            </div>
          </label>` : ""}
        </div>

        ${sellMode ? `<div class="market-builder-summary">
          <div><span>Sell Revenue</span><strong>CR ${formatNumber(sellRevenue)}</strong></div>
              <div><span>Source</span><strong>${sellOrigin}</strong></div>
              <div class="profit-summary-card"><span>${stagingRecoveredCargoSale ? "Recovered Value" : "Sell Profit"}</span><strong class="${sellProfit >= 0 ? "profit-good" : "profit-bad"}">${stagingRecoveredCargoSale ? "CR " : sellProfit >= 0 ? "+" : "-"}${stagingRecoveredCargoSale ? formatNumber(sellProfit) : `CR ${formatNumber(Math.abs(sellProfit))}`}</strong></div>
        </div>` : ""}

        ${held > 0 ? `<div class="market-builder-actions has-sell">
          <div class="trade-preview-note staging-sell-summary">
            <strong>${stagingRecoveredCargoSale ? "Recovered cargo" : sellMode ? "Cargo ready to sell" : "Cargo in hold"}</strong>
            <span>${sellMode ? `Selling ${formatNumber(effectiveQuantity)} of ${formatNumber(held)} ${resource} at ${currentPlanet} for CR ${formatNumber(sellUnitPrice)} each` : `Carrying ${formatNumber(held)} ${resource}. Deliver it to ${activeMarketTrade?.destination || targetPlanet} to sell the route.`}</span>
          </div>
          ${sellMode || stagingTradeLocked
            ? ""
            : `<button class="trade-primary-action market-sell-action" data-tutorial-target="sellCargo" onclick="sellMarketCargo()" ${atTargetWithCargo ? "" : "disabled"}>${atTargetWithCargo ? "Sell Cargo" : "Sell Here"}</button>`}
        </div>` : ""}
        ${stagingTradeNotice}
      </aside>
    </div>
  `;
}

function setLegacyMarketResource(good) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good)) return;
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive() && !canSelectMultiplayerStagingMarketResource(good, getCurrentMarketPlanet())) {
    if (typeof addHudToast === "function") addHudToast("That resource is not available on a supported route from this planet.");
    return;
  }
  selectedMarketResource = good;
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const currentPlanet = getCurrentMarketPlanet();
    const sellOffer = Number(cargo[good] || 0) > 0
      ? findMultiplayerStagingSellOffer({ good, destination: currentPlanet })
      : null;
    if (sellOffer) {
      selectedMarketTargetPlanet = currentPlanet;
    } else {
      const targets = getMultiplayerStagingTargetPlanetsForResource(good, currentPlanet);
      if (targets.length && (!targets.includes(selectedMarketTargetPlanet) || selectedMarketTargetPlanet === currentPlanet)) {
        selectedMarketTargetPlanet = getBestMultiplayerStagingTargetPlanet(good, currentPlanet) || targets[0];
      }
    }
  }
  tutorialEvent("selectedMarketResource");
  renderMarketplace();
}

function setMarketTargetPlanet(planet) {
  if (!MAP_ONE_MARKET_PLANETS.includes(planet)) return;
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive() && getMultiplayerStagingTradeOffers().length) {
    const targets = getMultiplayerStagingTargetPlanetsForResource(selectedMarketResource, getCurrentMarketPlanet());
    if (targets.length && !targets.includes(planet)) {
      if (typeof addHudToast === "function") addHudToast("That destination is not part of this trade route.");
      return;
    }
  }
  selectedMarketTargetPlanet = planet;
  tutorialEvent("selectedMarketTarget");
  renderMarketplace();
}

function selectMarketRouteDestination(destination) {
  setMarketTargetPlanet(destination);
}

function getMarketRouteLoadBlockReason(route) {
  if (!route) return "Trade route unavailable.";
  if (route.isLoss) return "Not recommended: this route would lose credits.";
  if (!route.buyPrice || route.buyPrice <= 0) return "Buy price unavailable for this resource.";
  if (route.pending) return "Trade request already pending.";
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive() && !route.stagingOffer) return "Server trade route unavailable.";
  if (route.selectedUnits <= 0) {
    const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
    if (freeCargo <= 0) return "Cargo hold is full.";
    if (credits < route.buyPrice) return "Not enough credits.";
    return "No cargo can be loaded.";
  }
  if (credits < route.totalCost) return "Not enough credits.";
  if (Math.max(0, getShipStats().cargo - cargoUsed()) < route.selectedUnits) return "Cargo hold is full.";
  return "";
}

function showMarketRouteLoadMessage(message) {
  if (!message) return;
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
}

function loadMarketRouteCargo(destination, event) {
  if (event?.stopPropagation) event.stopPropagation();
  normalizeMarketBuilderState();

  const currentPlanet = getCurrentMarketPlanet();
  const tutorialTradeActive = isLocalTutorialTradeActive();
  const stagingTradeLocked = isMultiplayerStagingActive() && !tutorialTradeActive;
  const routes = getMarketRouteCards({
    resource: selectedMarketResource,
    origin: currentPlanet,
    quantity: selectedMarketQuantity,
    stagingTradeLocked
  });
  const route = routes.find(candidate => candidate.destination === destination);
  selectedMarketTargetPlanet = destination;
  tutorialEvent("selectedMarketTarget");

  const blockReason = getMarketRouteLoadBlockReason(route);
  if (blockReason) {
    showMarketRouteLoadMessage(blockReason);
    renderMarketplace();
    return;
  }

  selectedMarketQuantity = route.selectedUnits;
  buyMarketCargo();
}

function confirmMarketTargetPlanet() {
  setMarketTargetPlanet(selectedMarketTargetPlanet);
}

function syncLegacyMarketQuantity(value) {
  normalizeMarketBuilderState();
  selectedMarketQuantity = clampNumber(value, 1, Math.max(1, getMarketQuantityLimit()));
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function adjustLegacyMarketQuantity(delta) {
  normalizeMarketBuilderState();
  selectedMarketQuantity = clampNumber((selectedMarketQuantity || 1) + delta, 1, Math.max(1, getMarketQuantityLimit()));
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function setLegacyMarketQuantityMax() {
  normalizeMarketBuilderState();
  selectedMarketQuantity = Math.max(1, getMarketQuantityLimit());
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function getLegacyMarketQuantityLimit() {
  const localRouteSellReady = getLocalRouteSellReadyState();
  if (localRouteSellReady.ready && selectedMarketResource === localRouteSellReady.good) {
    return Math.max(1, localRouteSellReady.held);
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const currentPlanet = getCurrentMarketPlanet();
    const sellOffer = Number(cargo[selectedMarketResource] || 0) > 0
      ? findMultiplayerStagingSellOffer({ good: selectedMarketResource, destination: currentPlanet })
      : null;
    return getMultiplayerStagingTradeQuantityLimit({
      operation: sellOffer ? "sell" : "buy",
      good: selectedMarketResource,
      origin: currentPlanet,
      destination: selectedMarketTargetPlanet
    });
  }
  return Math.max(1, getMarketMaxBuyQuantity());
}

let marketBuyInProgress = false;
let marketSellInProgress = false;

function buyLegacyMarketCargo() {
  if (marketBuyInProgress) return;
  normalizeMarketBuilderState();

  const currentPlanet = getCurrentMarketPlanet();
  const good = selectedMarketResource;
  const tutorialTradeActive = isLocalTutorialTradeActive();
  const stagingTradeActive = isMultiplayerStagingActive() && !tutorialTradeActive;
  if (tutorialTradeActive && activeTradeRoute?.marketTrade && activeTradeRoute.good === good && Number(cargo[good] || 0) > 0) {
    tutorialEvent("boughtTradeCargo");
    renderMarketplace();
    updateCargoSummary();
    updateSpaceHUD();
    renderObjectiveHud();
    return;
  }
  const stagingOffer = stagingTradeActive
    ? findMultiplayerStagingTradeOffer({
      good,
      origin: currentPlanet,
      destination: selectedMarketTargetPlanet
    })
    : null;
  const quantity = stagingTradeActive
    ? clampNumber(selectedMarketQuantity || 1, 1, getMultiplayerStagingTradeQuantityLimit({
      operation: "buy",
      good,
      origin: currentPlanet,
      destination: selectedMarketTargetPlanet
    }))
    : selectedMarketQuantity;
  if (stagingTradeActive && !stagingOffer) {
    const message = "No staging trade route is available for that purchase.";
    if (typeof addHudToast === "function") addHudToast(message);
    if (typeof addActivityLog === "function") addActivityLog(message);
    return;
  }

  const price = stagingTradeActive ? Number(stagingOffer.buyPrice || 0) : getMapOneMarketPrice(good, currentPlanet);
  const sellPrice = stagingTradeActive ? Number(stagingOffer.sellPrice || 0) : getMapOneMarketPrice(good, selectedMarketTargetPlanet);
  const destination = stagingTradeActive ? stagingOffer.sellNode : selectedMarketTargetPlanet;
  const totalCost = price * quantity;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());

  if (quantity <= 0 || !price || credits < totalCost || freeCargo < quantity) {
    alert("Check quantity, credits and cargo space before buying.");
    return;
  }

  marketBuyInProgress = true;
  credits -= totalCost;
  cargo[good] = (cargo[good] || 0) + quantity;
  updatePurchasedCargoCostBasis(good, quantity, price);
  setActiveTradeObjective({
    id: stagingTradeActive ? `staging-trade-${stagingOffer.offerId || Date.now()}` : `market-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good,
    origin: currentPlanet,
    destination,
    buyPrice: price,
    sellPrice,
    profitPerUnit: sellPrice - price,
    maxUnits: quantity,
    purchasedUnits: quantity,
    realizedProfit: 0,
    marketTrade: true,
    stagingTrade: stagingTradeActive,
    tutorialTrade: tutorialTradeActive
  });

  if (typeof addActivityLog === "function") {
    const estimatedRouteProfit = (sellPrice - price) * quantity;
    addActivityLog(`Trade accepted: ${currentPlanet} -> ${destination}. Loaded ${formatNumber(quantity)} ${good}. Estimated profit: ${estimatedRouteProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedRouteProfit))}.`);
  }
  tutorialEvent("boughtTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  renderObjectiveHud();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
  marketBuyInProgress = false;
}

function sellLegacyMarketCargo() {
  if (marketSellInProgress) return;
  normalizeMarketBuilderState();
  const good = selectedMarketResource;
  const held = cargo[good] || 0;
  const tutorialTradeActive = isLocalTutorialTradeActive();
  const stagingTradeActive = isMultiplayerStagingActive() && !tutorialTradeActive;

  if (held <= 0) {
    if (typeof addHudToast === "function") addHudToast(`No ${good} cargo to sell.`);
    return;
  }

  const currentPlanet = getCurrentMarketPlanet();
  const stagingOffer = stagingTradeActive
    ? findMultiplayerStagingSellOffer({ good, destination: currentPlanet })
    : null;
  if (stagingTradeActive && !stagingOffer) {
    const message = `No staging buyer is available for ${good} at ${currentPlanet}.`;
    if (typeof addHudToast === "function") addHudToast(message);
    if (typeof addActivityLog === "function") addActivityLog(message);
    return;
  }

  const quantity = stagingTradeActive
    ? clampNumber(selectedMarketQuantity || held, 1, Math.min(held, getMultiplayerStagingTradeQuantityLimit({
      operation: "sell",
      good,
      origin: currentPlanet,
      destination: currentPlanet
    })))
    : held;
  const price = stagingTradeActive ? Number(stagingOffer.sellPrice || 0) : getEffectiveSellPrice(good, currentPlanet);
  const cargoUnitBasis = getCargoCostBasisForResource(good);
  const recoveredHeld = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(good) : (cargoUnitBasis === null ? held : 0);
  const recoveredSold = Math.min(quantity, recoveredHeld);
  const purchasedSold = Math.max(0, quantity - recoveredSold);
  const recoveredCargoSale = recoveredSold > 0 && purchasedSold === 0;
  const unitCost = cargoUnitBasis || (stagingTradeActive ? Number(stagingOffer.buyPrice || 0) : getEffectiveBuyPrice(good, currentPlanet)) || price;
  const saleRevenue = price * quantity;
  const purchasedProfit = purchasedSold * (price - unitCost);
  const tradeProfit = recoveredCargoSale ? saleRevenue : (recoveredSold * price) + purchasedProfit;

  if (quantity <= 0 || !price) {
    if (typeof addHudToast === "function") addHudToast(`Cannot sell ${good} at this market.`);
    return;
  }

  marketSellInProgress = true;
  if (typeof consumeRecoveredCargoQuantity === "function") consumeRecoveredCargoQuantity(good, recoveredSold);
  cargo[good] = Math.max(0, held - quantity);
  credits += saleRevenue;
  if (cargo[good] <= 0 || getPurchasedCargoQuantity(good) <= 0) delete cargoCostBasis[good];
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + quantity;

  const activeTrade = getActiveTradePricing(good);
  if (purchasedSold > 0 && activeTrade && currentPlanet === activeTrade.destination) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTrade.realizedProfit || 0)) + Math.max(0, purchasedProfit)
    });
  }

  if (recoveredSold > 0 && typeof addActivityLog === "function") {
    addActivityLog(`Recovered resource sale: sold ${formatNumber(recoveredSold)} ${good} at ${currentPlanet} for CR ${formatNumber(recoveredSold * price)} value.`);
  } else if (stagingTradeActive && typeof addActivityLog === "function") {
    addActivityLog(`Sold ${formatNumber(quantity)} ${good} at ${currentPlanet} for ${purchasedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(purchasedProfit))} profit.`);
  }
  showTradeResultBurst({
    good,
    quantity,
    profit: tradeProfit,
    revenue: saleRevenue,
    valueMode: recoveredCargoSale,
    title: recoveredCargoSale ? "Recovered Cargo Sold" : "",
    detail: recoveredCargoSale ? `Sold ${formatNumber(quantity)} ${good} at ${currentPlanet}` : ""
  });
  showTradeMiniFloat({ profit: tradeProfit });
  if (purchasedSold > 0) completeActiveTradeIfReady(good);
  tutorialEvent("soldTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  marketSellInProgress = false;
}

function renderBuyCommodities(market, stock, goodsBox) {
  goodsBox.innerHTML = `<div class="trade-commodity-grid"></div>`;
  const grid = goodsBox.querySelector(".trade-commodity-grid");
  const stagingTradeLocked = isMultiplayerStagingActive();

  MAP_ONE_TRADE_RESOURCES.forEach(good => {
    const buyPrice = market[good];
    const info = commodityInfo[good];
    const availableCargo = getShipStats().cargo - cargoUsed();
    const maxAffordable = Math.floor(credits / buyPrice);
    const maxBuy = Math.max(0, Math.min(stock[good] ?? 0, availableCargo, maxAffordable));
    const rarityClass = getCommodityRarityClass(good);

    const item = document.createElement("div");
    item.className = `trade-commodity-card ${rarityClass}`;
    item.id = `tradeCard-${safeId(good)}`;

    item.innerHTML = `
      <div class="trade-commodity-top">
        <div class="commodity-cell">
          <div class="commodity-icon trade-commodity-icon">
            <img src="${info.icon}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${good}</div>
            <div class="commodity-rarity">${info.rarity}</div>
          </div>
        </div>
      </div>

      <div class="trade-compact-stats buy-compact-stats">
        <div><span>Available</span><strong>${formatNumber(stock[good] ?? 0)}</strong></div>
        <div><span>Buy</span><strong>CR ${formatNumber(buyPrice)}</strong></div>
      </div>

      <div class="trade-compact-control">
        <div class="trade-control-header">
          <strong>Buy</strong>
          <span id="buySummary-${safeId(good)}">0 units / CR 0</span>
        </div>
        <input
          class="trade-range"
          id="buyRange-${safeId(good)}"
          type="range"
          min="0"
          max="${maxBuy}"
          value="0"
          oninput="updateTradePreview('${good}')"
        />
        <div class="trade-control-actions compact-trade-actions">
          <input
            class="qty-input compact-qty"
            id="buyQty-${safeId(good)}"
            type="number"
            min="0"
            max="${maxBuy}"
            value="0"
            oninput="syncTradeInput('${good}', 'buy')"
          />
          <button onclick="setTradeMax('${good}', 'buy')">Max</button>
          <button onclick="buyGood('${good}')">${stagingTradeLocked ? "Preview" : "Buy"}</button>
        </div>
      </div>
    `;

    grid.appendChild(item);
    updateTradePreview(good);
  });
}

function renderSellCommodities(market, stock, goodsBox) {
  const heldGoods = mineralKeys.filter(good => (cargo[good] || 0) > 0);
  const stagingTradeLocked = isMultiplayerStagingActive();

  if (!heldGoods.length) {
    goodsBox.innerHTML = `<div class="terminal-empty-state">Your cargo hold is empty. Buy or salvage commodities first.</div>`;
    return;
  }

  goodsBox.innerHTML = `<div class="trade-commodity-grid"></div>`;
  const grid = goodsBox.querySelector(".trade-commodity-grid");

  heldGoods.forEach(good => {
    const sellPrice = getCommoditySellPrice(good, currentNode);
    const info = commodityInfo[good];
    const held = cargo[good] || 0;
    const basis = cargoCostBasis[good] || 0;
    const estimatedProfit = basis ? Math.round((sellPrice - basis) * held) : 0;
    const rarityClass = getCommodityRarityClass(good);

    const item = document.createElement("div");
    item.className = `trade-commodity-card ${rarityClass}`;
    item.id = `tradeCard-${safeId(good)}`;

    item.innerHTML = `
      <div class="trade-commodity-top">
        <div class="commodity-cell">
          <div class="commodity-icon trade-commodity-icon">
            <img src="${info.icon}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${good}</div>
            <div class="commodity-rarity">${info.rarity}</div>
          </div>
        </div>
      </div>

      <div class="trade-compact-stats">
        <div><span>Held</span><strong>${formatNumber(held)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(sellPrice)}</strong></div>
        <div><span>Profit</span><strong class="${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))}` : "N/A"}</strong></div>
      </div>

      <div class="trade-compact-control">
        <div class="trade-control-header">
          <strong>Sell</strong>
          <span id="sellSummary-${safeId(good)}">0 units / CR 0</span>
        </div>
        <input
          class="trade-range"
          id="sellRange-${safeId(good)}"
          type="range"
          min="0"
          max="${held}"
          value="0"
          oninput="updateTradePreview('${good}')"
        />
        <div class="trade-control-actions compact-trade-actions">
          <input
            class="qty-input compact-qty"
            id="sellQty-${safeId(good)}"
            type="number"
            min="0"
            max="${held}"
            value="0"
            oninput="syncTradeInput('${good}', 'sell')"
          />
          <button onclick="setTradeMax('${good}', 'sell')">All</button>
          <button onclick="sellGood('${good}')">${stagingTradeLocked ? "Preview" : "Sell"}</button>
        </div>
      </div>
    `;

    grid.appendChild(item);
    updateTradePreview(good);
  });
}

function getTradeRecommendations() {
  const planets = Object.keys(planetMarkets);
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());

  const routes = [];

  mineralKeys.forEach(good => {
    planets.forEach(origin => {
      planets.forEach(destination => {
        if (origin === destination) return;

        const buyPrice = getCommodityBuyPrice(good, origin);
        const sellPrice = getCommoditySellPrice(good, destination);
        const profitPerUnit = sellPrice - buyPrice;
        if (profitPerUnit <= 0) return;

        const affordable = Math.floor(credits / buyPrice);
        const routeAllowance = getTradeContractUnitAllowance(good, origin, destination);
        const maxUnits = Math.max(0, Math.min(routeAllowance, affordable, freeCargo || getShipStats().cargo));
        const potentialProfit = profitPerUnit * maxUnits;

        routes.push({
          good,
          origin,
          destination,
          buyPrice,
          sellPrice,
          profitPerUnit,
          maxUnits,
          potentialProfit,
          currentOrigin: origin === currentNode
        });
      });
    });
  });

  return routes.sort((a, b) => {
    if (a.currentOrigin !== b.currentOrigin) return a.currentOrigin ? -1 : 1;
    return b.potentialProfit - a.potentialProfit;
  }).slice(0, 6);
}

function renderOpportunityTrades(goodsBox) {
  const routes = getTradeRecommendations();

  if (!routes.length) {
    goodsBox.innerHTML = `<div class="terminal-empty-state">No profitable opportunities are visible in the current market cycle.</div>`;
    return;
  }

  goodsBox.innerHTML = `
    <div class="hot-trades-grid premium-opportunities-grid compact-opportunities-grid lean-opportunities-grid">
      ${routes.map((route, index) => {
        const info = commodityInfo[route.good];
        const routeHint = route.currentOrigin ? "Tap to buy" : `Go to ${route.origin}`;
        const routeState = route.currentOrigin ? "Here" : "Route";

        return `
          <div
            class="hot-trade-card premium-opportunity-card compact-opportunity-card lean-opportunity-card ${getCommodityRarityClass(route.good)} ${route.currentOrigin ? "current-origin is-actionable" : ""} ${index === 0 ? "top-route" : ""}"
            data-good="${route.good}"
            data-origin="${route.origin}"
            data-destination="${route.destination}"
            data-max-units="${route.maxUnits}"
            data-current-origin="${route.currentOrigin ? "1" : "0"}"
            tabindex="0"
            role="button"
            aria-label="${route.good} trade route from ${route.origin} to ${route.destination}"
          >
            <div class="hot-trade-top compact-hot-trade-top lean-hot-trade-top">
              <div class="commodity-cell compact-commodity-cell">
                <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
                  <img src="${info.icon}" alt="${route.good}" class="commodity-icon-img">
                </div>
                <div>
                  <div class="commodity-name">${route.good}</div>
                  <div class="commodity-rarity">${info.rarity || "Common"}</div>
                </div>
              </div>
              <div class="lean-route-badges">
                ${index === 0 ? `<span class="top-route-ribbon inline-route-ribbon">Best</span>` : ""}
                <span class="route-badge">${routeState}</span>
              </div>
            </div>

            <div class="opportunity-route-row compact-opportunity-route-row lean-route-row">
              <span class="trade-location-chip origin">${route.origin}</span>
              <span class="trade-route-arrow">-></span>
              <span class="trade-location-chip destination">${route.destination}</span>
            </div>

            <div class="hot-trade-stats compact-hot-trade-stats lean-hot-trade-stats">
              <div><span>Buy</span><strong>CR ${formatNumber(route.buyPrice)}</strong></div>
              <div><span>Sell</span><strong>CR ${formatNumber(route.sellPrice)}</strong></div>
              <div><span>Profit</span><strong class="profit-good">+CR ${formatNumber(route.profitPerUnit)}</strong></div>
            </div>

            <div class="hot-trade-footer compact-hot-trade-footer lean-hot-trade-footer">
              <span>${routeHint}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  goodsBox.querySelectorAll('.premium-opportunity-card').forEach(card => {
    const currentOrigin = card.dataset.currentOrigin === "1";
    card.addEventListener('click', () => stageTradeOpportunityFromCard(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        stageTradeOpportunityFromCard(card);
      }
    });
    if (!currentOrigin) {
      card.classList.add('route-preview-only');
    }
  });
}

function getAcceptedTradeRouteFromContract(route) {
  return {
    id: `trade-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good: route.good,
    origin: route.origin,
    destination: route.destination,
    buyPrice: route.buyPrice,
    sellPrice: route.sellPrice,
    profitPerUnit: route.profitPerUnit,
    maxUnits: route.maxUnits,
    purchasedUnits: 0,
    acceptedAtCycle: getMarketCycle()
  };
}

function getContractMinimumProfit(good, buyPrice) {
  const rarity = (commodityInfo[good]?.rarity || "Common").toLowerCase();
  const rarityBoost = rarity === "exotic" ? 0.22 : rarity === "rare" ? 0.18 : rarity === "industrial" ? 0.14 : 0.10;
  return Math.max(2, Math.round(buyPrice * rarityBoost));
}

function getTradeContractUnitAllowance(good, origin, destination) {
  const shipCargo = getShipStats().cargo || 100;
  const rarity = (commodityInfo[good]?.rarity || "Common").toLowerCase();

  // Station-backed trade contracts should reward bigger cargo bays.
  // Common and industrial freight are deliberately bulkier than rare goods.
  const rarityCap = rarity === "exotic" ? 1.10 : rarity === "rare" ? 1.35 : rarity === "industrial" ? 1.85 : 2.25;
  const hash = marketHash(`${getMarketCycle()}:${origin}:${destination}:${good}:allowance`);
  const swing = 0.9 + ((hash % 41) / 100); // 90% to 130% of rarity-adjusted ship cargo
  const minimumUsefulContract = Math.ceil(shipCargo * (rarity === "common" ? 1.15 : rarity === "industrial" ? 0.95 : 0.65));

  return Math.max(1, minimumUsefulContract, Math.floor(shipCargo * rarityCap * swing));
}

function getTradeRouteChoiceScore(route) {
  const jumps = Math.max(1, getTradeRouteJumpCount(route));
  const rarity = (commodityInfo[route.good]?.rarity || "Common").toLowerCase();
  const rarityWeight = rarity === "exotic" ? 0.78 : rarity === "rare" ? 0.88 : rarity === "industrial" ? 1.04 : 1.12;
  const bulkScore = Math.sqrt(Math.max(1, Number(route.maxUnits || 1))) * Number(route.profitPerUnit || 0) * rarityWeight;
  const totalScore = Number(route.potentialProfit || 0) * 0.72;
  const efficiencyScore = (Number(route.potentialProfit || 0) / jumps) * 0.18;
  return Math.round(totalScore + bulkScore + efficiencyScore);
}

function getTradeRouteDifferenceScore(route, picked) {
  if (!picked.length) return 999999;

  return Math.max(...picked.map(existing => {
    let score = 0;
    if (existing.good !== route.good) score += 90;
    if (existing.destination !== route.destination) score += 60;
    if (existing.origin !== route.origin) score += 25;

    const unitGap = Math.abs(Number(existing.maxUnits || 0) - Number(route.maxUnits || 0));
    const marginGap = Math.abs(Number(existing.profitPerUnit || 0) - Number(route.profitPerUnit || 0));
    const profitGap = Math.abs(Number(existing.potentialProfit || 0) - Number(route.potentialProfit || 0));

    score += Math.min(45, unitGap / 3);
    score += Math.min(45, marginGap * 2);
    score += Math.min(55, profitGap / 45);
    return score;
  }));
}

function isTradeRouteMeaningfullyDifferent(route, picked) {
  if (!picked.length) return true;
  return getTradeRouteDifferenceScore(route, picked) >= 95;
}

function buildStationTradeContracts(origin = currentNode) {
  const destinations = Object.keys(planetMarkets).filter(planet => planet !== origin);
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const usableCargo = freeCargo || getShipStats().cargo;
  const routes = [];

  MAP_ONE_TRADE_RESOURCES.forEach(good => {
    destinations.forEach(destination => {
      const buyPrice = getCommodityBuyPrice(good, origin);
      const marketSellPrice = getCommoditySellPrice(good, destination);
      const sellPrice = Math.max(marketSellPrice, buyPrice + getContractMinimumProfit(good, buyPrice));
      const profitPerUnit = sellPrice - buyPrice;
      const contractAllowance = getTradeContractUnitAllowance(good, origin, destination);
      const affordable = Math.max(0, Math.floor(credits / buyPrice));
      const maxUnits = Math.max(0, Math.min(contractAllowance, affordable || contractAllowance, usableCargo));
      const potentialProfit = profitPerUnit * Math.max(1, maxUnits);
      const jumps = Math.max(1, getTradeRouteJumpCount({ origin, destination }));

      routes.push({
        good,
        origin,
        destination,
        buyPrice,
        sellPrice,
        profitPerUnit,
        maxUnits,
        potentialProfit,
        jumps,
        currentOrigin: true,
        stationBacked: marketSellPrice < sellPrice,
        choiceScore: getTradeRouteChoiceScore({ good, origin, destination, profitPerUnit, maxUnits, potentialProfit })
      });
    });
  });

  return routes.sort((a, b) => {
    if (b.choiceScore !== a.choiceScore) return b.choiceScore - a.choiceScore;
    if (b.potentialProfit !== a.potentialProfit) return b.potentialProfit - a.potentialProfit;
    if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
    return a.good.localeCompare(b.good);
  });
}

function getCurrentTradeContracts() {
  const maxVisibleTrades = 2;
  const stationRoutes = buildStationTradeContracts(currentNode);
  const picked = [];
  const usedGoods = new Set();
  const usedDestinations = new Set();

  stationRoutes.forEach(route => {
    if (picked.length >= maxVisibleTrades) return;
    if (usedGoods.has(route.good)) return;
    if (usedDestinations.has(route.destination)) return;
    picked.push(route);
    usedGoods.add(route.good);
    usedDestinations.add(route.destination);
  });

  stationRoutes.forEach(route => {
    if (picked.length >= maxVisibleTrades) return;
    if (!isTradeRouteMeaningfullyDifferent(route, picked)) return;
    picked.push(route);
  });

  if (picked.length < maxVisibleTrades) {
    stationRoutes.forEach(route => {
      if (picked.length >= maxVisibleTrades) return;
      if (picked.some(existing => existing.good === route.good && existing.destination === route.destination)) return;
      picked.push(route);
    });
  }

  return picked;
}

function acceptTradeRoute(good, origin, destination) {
  const route = getCurrentTradeContracts().find(candidate =>
    candidate.good === good && candidate.origin === origin && candidate.destination === destination
  );

  if (!route) {
    alert("That trade signal has expired. Check the current contracts again.");
    renderMarketplace();
    return;
  }

  const acceptedRoute = getAcceptedTradeRouteFromContract(route);
  setActiveTradeObjective(acceptedRoute);
  selectedStationTradeRoute = null;
  activeTradeTerminalTab = "contracts";
  addActivityLog(`Trade route accepted: buy ${formatNumber(acceptedRoute.maxUnits || 0)} ${good} at ${origin} to lock in the run.`);
  saveGame();
  renderMarketplace();
  updateSpaceHUD();
  renderObjectiveHud();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}

function abandonTradeRoute(force = false) {
  const trade = getActiveObjective();
  if (trade?.dailyTradeContract) {
    if (!force && !window.confirm(`Abandon ${trade.title}?\n\nThe sealed package will be removed from your cargo hold and no reward will be paid.`)) return;
    const contract = typeof getDailyTradeContract === "function" ? getDailyTradeContract(trade.contractId) : null;
    if (contract?.status === "active") {
      contract.status = "available";
      contract.acceptedAt = 0;
      contract.loadedAt = 0;
      contract.packageLoaded = false;
    }
    activeDailyTradeContractId = null;
    dailyTradeContractCargo = null;
    clearActiveObjective("trade");
    addActivityLog("Courier contract abandoned. The sealed package was returned.");
    saveGame();
    renderMarketplace();
    updateCargoSummary();
    updateSpaceHUD();
    renderObjectiveHud();
    return;
  }
  const carriedGood = activeTradeRoute?.good || activeObjective?.good;
  const held = carriedGood ? (cargo[carriedGood] || 0) : 0;

  if (!force && trade?.type === "trade") {
    const warning = held > 0
      ? `Abandon this ${trade.good} trade?\n\nYou are carrying ${formatNumber(held)} units. The cargo will remain in your hold, but the route objective and protected contract pricing will end.`
      : `Abandon this ${trade.good} trade route?\n\nThe active route objective and protected contract pricing will end.`;

    if (!window.confirm(warning)) return;
  }

  clearActiveObjective("trade");

  if (carriedGood && held > 0) {
    selectedLooseCargoSellGood = carriedGood;
    addActivityLog(`${carriedGood} trade closed. Cargo can still be sold from the Trade Terminal.`);
  } else {
    addActivityLog("Trade route closed.");
  }

  saveGame();
  renderMarketplace();
  updateSpaceHUD();
}

function renderTradeContractsTerminal(market, stock, goodsBox) {
  const contracts = getCurrentTradeContracts();
  const active = activeTradeRoute || (getActiveObjective()?.type === "trade" ? getActiveObjective() : null);

  if (selectedStationTradeRoute && !contracts.some(route => isSameTradeRoute(route, selectedStationTradeRoute))) {
    selectedStationTradeRoute = null;
  }

  const detailRoute = active || selectedStationTradeRoute;

  goodsBox.innerHTML = `
    <div class="trade-contract-terminal">
      <div class="trade-contract-grid">
        ${contracts.length ? contracts.map((route, index) => renderTradeContractCard(route, index)).join("") : `<div class="terminal-empty-state">No station trades are visible at this planet.</div>`}
      </div>
      <div class="accepted-trade-panel">
        ${renderAcceptedTradePanel(detailRoute, market, stock, !active && !!selectedStationTradeRoute)}
      </div>
    </div>
  `;
}


function getTradeRouteJumpCount(route) {
  if (!route) return 0;
  const path = findSectorRoute(route.origin, route.destination);
  return Math.max(0, path.length - 1);
}

function getTradeRouteEfficiency(route) {
  const jumps = Math.max(1, getTradeRouteJumpCount(route));
  return Math.round((Number(route.potentialProfit || 0)) / jumps);
}

function isSameTradeRoute(a, b) {
  return !!a && !!b && a.good === b.good && a.origin === b.origin && a.destination === b.destination;
}

function selectStationTradeRoute(good, origin, destination) {
  const route = getCurrentTradeContracts().find(candidate =>
    candidate.good === good && candidate.origin === origin && candidate.destination === destination
  );

  if (!route) {
    selectedStationTradeRoute = null;
    renderMarketplace();
    return;
  }

  selectedStationTradeRoute = route;
  renderMarketplace();
}


function renderTradeContractCard(route, index) {
  const info = commodityInfo[route.good] || {};
  const isActive = activeTradeRoute && activeTradeRoute.good === route.good && activeTradeRoute.origin === route.origin && activeTradeRoute.destination === route.destination;
  const isSelected = isSameTradeRoute(selectedStationTradeRoute, route);
  const marginPerUnit = route.sellPrice - route.buyPrice;
  const jumps = getTradeRouteJumpCount(route);
  const efficiency = getTradeRouteEfficiency(route);

  return `
    <div class="trade-contract-card compact-station-card selectable-station-card ${getCommodityRarityClass(route.good)} ${isActive ? "active-contract" : ""} ${isSelected ? "selected-contract" : ""}">
      <div class="trade-contract-top slim-contract-top">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(route.good)}" alt="${route.good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${route.good}</div>
            <div class="commodity-rarity">${route.origin} &gt; ${route.destination}</div>
          </div>
        </div>
        <span class="trade-margin-chip ${marginPerUnit >= 0 ? "profit-good" : "profit-bad"}">${marginPerUnit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(marginPerUnit))}</span>
      </div>

      <div class="station-trade-line station-trade-line-expanded">
        <span>Units <strong>${formatNumber(route.maxUnits)}</strong></span>
        <span>Jumps <strong>${formatNumber(jumps)}</strong></span>
        <span>CR/Jump <strong>${formatNumber(efficiency)}</strong></span>
      </div>

      <button class="accept-trade-btn" onclick="${isActive ? "" : `selectStationTradeRoute('${escapeJsString(route.good)}', '${escapeJsString(route.origin)}', '${escapeJsString(route.destination)}')`}">
        ${isActive ? "Route Active" : isSelected ? "Selected" : "Preview"}
      </button>
    </div>
  `;
}

function openLooseCargoSale(good) {
  if (!mineralKeys.includes(good) || (cargo[good] || 0) <= 0) return;
  selectedLooseCargoSellGood = good;
  renderMarketplace();
}

function renderLooseCargoSellPanel() {
  const heldGoods = mineralKeys.filter(good => (cargo[good] || 0) > 0);

  if (!heldGoods.length) {
    selectedLooseCargoSellGood = null;
    return `
      <div class="accepted-trade-empty compact-trade-empty">
        <h3>Station Trade</h3>
        <p>Select one available station trade to preview cost, return and route.</p>
      </div>
    `;
  }

  if (!selectedLooseCargoSellGood || !heldGoods.includes(selectedLooseCargoSellGood)) {
    selectedLooseCargoSellGood = heldGoods[0];
  }

  const good = selectedLooseCargoSellGood;
  const info = commodityInfo[good] || {};
  const held = cargo[good] || 0;
  const sellPrice = getCommoditySellPrice(good, currentNode);
  const basis = cargoCostBasis[good] || 0;
  const estimatedProfit = basis ? Math.round((sellPrice - basis) * held) : 0;

  setTimeout(() => updateTradePreview(good), 0);

  return `
    <div class="loose-cargo-panel accepted-trade-card cargo-ready-panel ${getCommodityRarityClass(good)}">
      <div class="trade-panel-kicker">Cargo Ready to Sell</div>
      <div class="accepted-trade-header compact-accepted-header">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(good)}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <h3>${good}</h3>
            <p>Held ${formatNumber(held)} / Sell at ${currentNode}</p>
          </div>
        </div>
      </div>

      <div class="loose-cargo-tabs compact-cargo-tabs">
        ${heldGoods.map(item => `
          <button class="loose-cargo-tab ${item === good ? "active" : ""}" onclick="openLooseCargoSale('${escapeJsString(item)}')">
            ${item} <span>${formatNumber(cargo[item] || 0)}</span>
          </button>
        `).join("")}
      </div>

      <div class="accepted-trade-stats compact-stat-row">
        <div><span>Held</span><strong>${formatNumber(held)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(sellPrice)}</strong></div>
        <div><span>Profit</span><strong class="${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))}` : "N/A"}</strong></div>
      </div>

      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${renderTradeQuantityControls(good, "sell", held, held, "Sell Cargo")}
        <div class="accepted-profit-line compact-return-line ${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))} estimated profit` : "No purchase basis recorded."}</div>
      </div>
    </div>
  `;
}

function renderAcceptedTradePanel(active, market, stock, isPreview = false) {
  if (!active) {
    return renderLooseCargoSellPanel();
  }

  const info = commodityInfo[active.good] || {};
  const held = cargo[active.good] || 0;
  const atOrigin = currentNode === active.origin;
  const atDestination = currentNode === active.destination;
  const routeText = `${active.origin} > ${active.destination}`;
  const marginPerUnit = active.sellPrice - active.buyPrice;
  const jumps = getTradeRouteJumpCount(active);
  const routeProfit = Number(active.maxUnits || 0) * marginPerUnit;
  const crPerJump = getTradeRouteEfficiency({ ...active, potentialProfit: routeProfit });

  let actionMarkup = "";

  if (isPreview) {
    actionMarkup = `
      <div class="trade-preview-accept-panel">
        <div class="trade-preview-note">Preview route before committing. Accepting creates the active objective and unlocks buy controls.</div>
        <button class="trade-primary-action accept-route-action" onclick="acceptTradeRoute('${escapeJsString(active.good)}', '${escapeJsString(active.origin)}', '${escapeJsString(active.destination)}')">Accept Trade</button>
      </div>
    `;
  } else if (atOrigin) {
    const buyPrice = getEffectiveBuyPrice(active.good, currentNode);
    const availableCargo = getShipStats().cargo - cargoUsed();
    const maxAffordable = Math.floor(credits / buyPrice);
    const routeAllowance = Number(active.maxUnits || getShipStats().cargo || 0);
    const alreadyPurchased = Number(active.purchasedUnits || 0);
    const remainingRouteUnits = Math.max(0, routeAllowance - alreadyPurchased);
    const maxBuy = Math.max(0, Math.min(remainingRouteUnits, availableCargo, maxAffordable));
    const needsLockIn = alreadyPurchased <= 0 && held <= 0;
    const defaultBuy = needsLockIn ? maxBuy : 0;
    const lockPromptText = maxBuy > 0
      ? `Purchase up to ${formatNumber(maxBuy)} ${active.good} before launching. The amount box is set to the most you can currently carry and afford.`
      : `Free cargo space or earn more credits, then buy ${active.good} here to lock in the route.`;
    const lockPrompt = needsLockIn
      ? `<div class="trade-lockin-prompt">
          <strong>Buy cargo to lock in</strong>
          <span>${lockPromptText}</span>
        </div>`
      : "";
    actionMarkup = `
      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${lockPrompt}
        ${renderTradeQuantityControls(active.good, "buy", maxBuy, defaultBuy, needsLockIn ? "Buy and Lock In" : "Buy Cargo")}
        <div id="buyRoi-${safeId(active.good)}" class="accepted-profit-line compact-return-line is-empty"></div>
      </div>
    `;
  } else if (atDestination) {
    const sellPrice = getEffectiveSellPrice(active.good, currentNode);
    const estimatedProfit = (cargoCostBasis[active.good] || active.buyPrice) ? Math.round((sellPrice - (cargoCostBasis[active.good] || active.buyPrice)) * held) : 0;
    actionMarkup = held > 0 ? `
      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${renderTradeQuantityControls(active.good, "sell", held, held, "Sell Cargo")}
        <div class="accepted-profit-line compact-return-line ${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))} estimated profit</div>
      </div>
    ` : `<div class="accepted-route-note compact-route-note">You reached ${active.destination}, but you have no ${active.good} in cargo.</div>`;
  } else {
    actionMarkup = `<div class="accepted-route-note compact-route-note">Accepted route is highlighted on the sector map.</div>`;
  }

  setTimeout(() => updateTradePreview(active.good), 0);

  return `
    <div class="accepted-trade-card selected-trade-panel ${getCommodityRarityClass(active.good)}">
      <div class="trade-panel-kicker">${isPreview ? "Trade Preview" : "Accepted Trade"}</div>
      <div class="accepted-trade-header compact-accepted-header">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(active.good)}" alt="${active.good}" class="commodity-icon-img">
          </div>
          <div>
            <h3>${active.good}</h3>
            <p>${routeText}</p>
          </div>
        </div>
        <button class="abandon-route-btn safer-abandon-route-btn" onclick="abandonTradeRoute()" aria-label="Abandon trade route">Abandon</button>
      </div>
      <div class="accepted-trade-stats compact-stat-row trade-route-stat-row">
        <div><span>Buy</span><strong>CR ${formatNumber(active.buyPrice)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(active.sellPrice)}</strong></div>
        <div><span>Margin</span><strong class="${marginPerUnit >= 0 ? "profit-good" : "profit-bad"}">${marginPerUnit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(marginPerUnit))}/u</strong></div>
        <div><span>Units</span><strong>${formatNumber(active.maxUnits || 0)}</strong></div>
        <div><span>Jumps</span><strong>${formatNumber(jumps)}</strong></div>
        <div><span>CR/Jump</span><strong class="${crPerJump >= 0 ? "profit-good" : "profit-bad"}">${formatNumber(crPerJump)}</strong></div>
      </div>
      ${actionMarkup}
    </div>
  `;
}

function completeActiveTradeIfReady(good) {
  if (!activeTradeRoute || activeTradeRoute.good !== good) return;
  if (currentNode !== activeTradeRoute.destination) return;
  if ((cargo[good] || 0) > 0) return;

  const realizedProfit = Math.max(0, Number(activeTradeRoute.realizedProfit || 0));
  addActivityLog(`Trade route completed: ${good} delivered to ${activeTradeRoute.destination}.`);
  if (realizedProfit > 0) {
    awardTradingXpFromProfit(realizedProfit);
  }
  clearActiveObjective("trade");
  updateSpaceHUD();
}

function normalizeTradeRoute(route) {
  if (!route || !sectorNodes[route.origin] || !sectorNodes[route.destination]) return null;

  if (route.dailyTradeContract) {
    if (!route.contractId || !route.packageId) return null;
    return {
      ...route,
      id: route.id || `daily-trade-${route.contractId}`,
      type: "trade",
      title: route.title || route.packageName || "Courier Contract",
      packageId: route.packageId,
      packageName: route.packageName || "Sealed Contract Package",
      packageImage: route.packageImage || "",
      origin: route.origin,
      destination: route.destination,
      cargoSpace: Math.max(0, Number(route.cargoSpace || 0)),
      reward: Math.max(0, Number(route.reward || 0)),
      maxUnits: 1,
      purchasedUnits: 1,
      realizedProfit: Math.max(0, Number(route.realizedProfit || 0)),
      createdAt: Number(route.createdAt || route.acceptedAt || Date.now()),
      status: route.status || "loaded"
    };
  }

  if (!route.good) return null;

  const buyPrice = Math.max(1, Number(route.buyPrice || getCommodityBuyPrice(route.good, route.origin) || 1));
  const sellPrice = Math.max(buyPrice, Number(route.sellPrice || buyPrice));
  const maxUnits = Number(route.maxUnits || getShipStats().cargo || 0);

  return {
    ...route,
    id: route.id || `trade-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good: route.good,
    origin: route.origin,
    destination: route.destination,
    buyPrice,
    sellPrice,
    profitPerUnit: Number(route.profitPerUnit ?? (sellPrice - buyPrice)),
    maxUnits,
    purchasedUnits: Number(route.purchasedUnits || 0),
    realizedProfit: Number(route.realizedProfit || 0),
    createdAt: Number(route.createdAt || route.acceptedAt || Date.now()),
    status: route.status || "active"
  };
}

function createTradeObjective(route) {
  const normalized = normalizeTradeRoute(route);
  if (!normalized) return null;

  return {
    ...normalized,
    type: "trade",
    title: normalized.dailyTradeContract
      ? (normalized.title || normalized.packageName || "Courier Contract")
      : `${normalized.good} Trade`
  };
}

function syncActiveTradeObjective() {
  if (activeTradeRoute) {
    activeTradeRoute = normalizeTradeRoute(activeTradeRoute);
  }

  if (activeObjective?.type === "trade") {
    activeObjective = createTradeObjective(activeObjective);
  }

  if (activeTradeRoute && !activeObjective) {
    activeObjective = createTradeObjective(activeTradeRoute);
  }

  if (!activeTradeRoute && activeObjective?.type === "trade") {
    activeTradeRoute = normalizeTradeRoute(activeObjective);
  }

  if (activeTradeRoute && activeObjective?.type === "trade") {
    const merged = normalizeTradeRoute({
      ...activeTradeRoute,
      purchasedUnits: Math.max(Number(activeTradeRoute.purchasedUnits || 0), Number(activeObjective.purchasedUnits || 0)),
      realizedProfit: Math.max(Number(activeTradeRoute.realizedProfit || 0), Number(activeObjective.realizedProfit || 0)),
      status: activeObjective.status || activeTradeRoute.status || "active"
    });
    activeTradeRoute = merged;
    activeObjective = createTradeObjective(merged);
  }

  return activeObjective?.type === "trade" ? activeObjective : null;
}

function getActiveObjective() {
  if (activeTradeRoute || activeObjective?.type === "trade") {
    return syncActiveTradeObjective();
  }
  if (activeObjective?.type === "bounty") return activeObjective;
  return null;
}

function setActiveTradeObjective(route) {
  activeTradeRoute = normalizeTradeRoute(route);
  activeObjective = activeTradeRoute ? createTradeObjective(activeTradeRoute) : null;
}

function updateActiveTradeProgress(fields = {}) {
  if (!activeTradeRoute && activeObjective?.type === "trade") {
    activeTradeRoute = normalizeTradeRoute(activeObjective);
  }

  if (activeTradeRoute) {
    activeTradeRoute = normalizeTradeRoute({
      ...activeTradeRoute,
      ...fields
    });
  }

  if (activeObjective?.type === "trade" || activeTradeRoute) {
    activeObjective = createTradeObjective({
      ...(activeTradeRoute || activeObjective),
      ...fields
    });
  }
}

function clearActiveObjective(type = null) {
  if (!type || type === "trade") {
    activeTradeRoute = null;
  }

  if (!type || activeObjective?.type === type) {
    activeObjective = null;
  }
}

function getTradeObjectiveTargetNode(objective = getActiveObjective()) {
  if (!objective || objective.type !== "trade") return null;
  if (objective.dailyTradeContract) return objective.destination;
  const held = cargo[objective.good] || 0;
  const quoteActive = isTradeObjectiveQuoteActive(objective);

  if ((held > 0 || Number(objective.purchasedUnits || 0) > 0) && !quoteActive) return null;
  if (currentNode === objective.destination) return objective.destination;
  if ((held > 0 || Number(objective.purchasedUnits || 0) > 0) && quoteActive) return objective.destination;
  return objective.origin;
}

function isTradeObjectiveQuoteActive(objective = getActiveObjective()) {
  if (!objective || objective.type !== "trade") return false;
  if (objective.dailyTradeContract || objective.tutorialTrade) return true;
  const acceptedCycle = Number(objective.acceptedAtCycle);
  if (!Number.isFinite(acceptedCycle)) return true;
  return typeof getMarketCycle !== "function" || acceptedCycle === getMarketCycle();
}

function getObjectiveRoutePath(objective = getActiveObjective()) {
  if (!objective) return [];
  if (objective.type === "trade") {
    const target = getTradeObjectiveTargetNode(objective);
    return target ? findSectorRoute(currentNode, target) : [];
  }
  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim") {
      const claimPlanet = getNearestPlanetNode(currentNode);
      return findSectorRoute(currentNode, claimPlanet);
    }
    const targetNode = getNearestActiveBountyBotNode(currentNode) || getNearestBountyAreaNode(currentNode, objective.targetArea);
    return targetNode ? findSectorRoute(currentNode, targetNode) : [];
  }
  return [];
}

function getTradeObjectiveStage(objective = getActiveObjective()) {
  if (!objective || objective.type !== "trade") return "none";
  if (objective.dailyTradeContract) return currentNode === objective.destination ? "deliver" : "travel";
  const held = cargo[objective.good] || 0;
  const quoteActive = isTradeObjectiveQuoteActive(objective);
  if (held > 0 && !quoteActive) return sectorNodes[currentNode]?.type === "planet" ? "sell-open" : "travel-open";
  if (currentNode === objective.destination) return held > 0 ? "sell" : "arrived";
  if (currentNode === objective.origin) return held > 0 ? "launch" : "buy";
  return "travel";
}

function getTradeObjectiveActionText(objective = getActiveObjective()) {
  const stage = getTradeObjectiveStage(objective);
  if (stage === "deliver") return "Complete delivery";
  if (stage === "buy") return "Buy stock";
  if (stage === "launch") return "Launch";
  if (stage === "sell") return "Sell cargo";
  if (stage === "sell-open") return "Review live prices";
  if (stage === "travel-open") return "Choose best market";
  if (stage === "arrived") return "Complete";
  if (stage === "travel") return `Go to ${objective.destination}`;
  return "No objective";
}

function getBountyObjectiveActionText(objective = getActiveObjective()) {
  if (!objective || objective.type !== "bounty") return "No objective";
  if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) {
    return sectorNodes[currentNode]?.type === "planet" ? "Claim reward at Bounty Board" : "Return to any planet to claim";
  }
  if (!isNodeInBountyArea(currentNode, objective.targetArea)) return `Go to ${objective.targetLabel}`;
  return "Destroy bots in area";
}

function renderObjectiveHud() {
  const panel = document.getElementById("activeObjectiveSummary");
  if (!panel) return;

  const objective = getActiveObjective();
  if (!objective) {
    const stagingBounty = getActiveMultiplayerStagingBountyObjective();
    if (stagingBounty) {
      const progress = Math.min(Number(stagingBounty.progress || 0), Number(stagingBounty.requiredKills || 2));
      const required = Number(stagingBounty.requiredKills || 2);
      const targetNode = getMultiplayerStagingBountyTargetNode();
      const routePath = targetNode && typeof findSectorRoute === "function" ? findSectorRoute(currentNode, targetNode) : [];
      const nextHop = routePath.length > 1 ? routePath[1] : targetNode;
      const actionText = stagingBounty.claimAvailable || stagingBounty.completed
        ? "Claim reward at Bounty Board"
        : targetNode
          ? currentNode === targetNode
            ? "Engage Erebus bot"
            : `Jump to ${nextHop || targetNode}`
          : "Scan or follow bounty route";
      const routeText = stagingBounty.claimAvailable || stagingBounty.completed
        ? "Return to Bounty Board"
        : targetNode
          ? `Target: ${targetNode}`
          : "Target: Erebus patrol";
      const objectiveIcon = getBountyIconSrc(
        stagingBounty.icon || getMultiplayerStagingBountyFallback().icon
      );
      const objectiveTitle = stagingBounty.title || `Destroy ${formatNumber(required)} Erebus bots`;
      panel.innerHTML = `
        <div class="objective-list compact-objective-list">
          <div class="objective-hud-card bounty-objective-card compact-objective-card orbit-objective-card staging-bounty-objective-card">
            <div class="objective-main-row compact-objective-main objective-orbit-row">
              <div class="objective-bounty-icon image objective-icon-large"><img src="${objectiveIcon}" alt="" onerror="this.src='assets/bounties/raider-sweep.png'; this.onerror=null;"></div>
              <div class="objective-copy objective-copy-large objective-orbit-copy">
              <div class="objective-title-line">
                <span class="objective-type-pill bounty-pill">Active Bounty</span>
                <strong>${objectiveTitle}</strong>
              </div>
              <span>${formatNumber(progress)} / ${formatNumber(required)} destroyed · ${routeText.replace(/^Target:\s*/, "")}</span>
              <em>${actionText}</em>
            </div>
            <div class="objective-orbit-meta">
              <span>Contract reward</span>
              <strong>CR ${formatNumber(stagingBounty.creditsReward || 0)} + ${formatNumber(stagingBounty.lupenShardsReward || 0)} Shards</strong>
            </div>
            <div class="objective-compact-actions objective-orbit-actions">
              <button class="objective-map-btn" onclick="openSectorMap()">Jump</button>
            </div>
            </div>
          </div>
        </div>
      `;
      return;
    }
    panel.innerHTML = `<div class="objective-empty">No active objective.</div>`;
    return;
  }

  if (objective.type === "trade") {
    if (objective.dailyTradeContract) {
      const targetNode = objective.destination;
      const path = getObjectiveRoutePath(objective);
      const nextHop = path.length > 1 ? path[1] : targetNode;
      const atDestination = currentNode === targetNode;
      panel.innerHTML = `
        <div class="objective-list compact-objective-list">
          <div class="objective-hud-card objective-trade-card contract-package-objective compact-objective-card orbit-objective-card">
            <div class="objective-main-row compact-objective-main objective-orbit-row">
              <div class="commodity-icon objective-icon objective-icon-large">
                <img src="${objective.packageImage}" alt="${objective.packageName}" class="commodity-icon-img">
              </div>
              <div class="objective-copy objective-copy-large objective-orbit-copy">
                <div class="objective-title-line">
                  <span class="objective-type-pill">Courier Contract</span>
                  <strong>${objective.packageName}</strong>
                </div>
                <span>${objective.origin} -> ${objective.destination}</span>
                <em>${atDestination ? "Complete delivery at the Trade Terminal" : `Next: ${nextHop || objective.destination}`}</em>
              </div>
              <div class="objective-orbit-meta">
                <span>${formatNumber(objective.cargoSpace)} cargo used</span>
                <strong class="profit-good">+CR ${formatNumber(objective.reward)}</strong>
              </div>
              <div class="objective-compact-actions objective-orbit-actions">
                <button class="objective-map-btn" onclick="openSectorMap()">Jump</button>
                <button class="objective-abandon-btn" onclick="abandonTradeRoute()">Abandon</button>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }
    const held = cargo[objective.good] || 0;
    const margin = objective.sellPrice - objective.buyPrice;
    const info = commodityInfo[objective.good] || {};
    const targetNode = getTradeObjectiveTargetNode(objective);
    const path = getObjectiveRoutePath(objective);
    const nextHop = path.length > 1 ? path[1] : targetNode;
    const stage = getTradeObjectiveStage(objective);
    const potentialProfit = held > 0 ? held * margin : Number(objective.maxUnits || 0) * margin;
    const quoteActive = isTradeObjectiveQuoteActive(objective);
    const refreshLabel = typeof getTradeCountdownLabel === "function" ? getTradeCountdownLabel() : "";
    const routeProgress = stage === "buy"
      ? "Buy cargo"
      : stage === "launch"
        ? (quoteActive && refreshLabel ? `Deliver before ${refreshLabel}` : "Review live prices")
        : stage === "travel"
          ? (quoteActive && refreshLabel ? `Next: ${nextHop || objective.destination} - sell before ${refreshLabel}` : "Review live prices")
          : stage === "sell"
            ? (quoteActive && refreshLabel ? `Sell before ${refreshLabel}` : "Sell cargo")
            : stage === "sell-open"
              ? "Review live prices"
              : stage === "travel-open"
                ? "Choose best market"
                : "Complete";
    const capacityText = `${formatNumber(held)} / ${formatNumber(objective.maxUnits || 0)}`;
    const profitText = `${potentialProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(potentialProfit))}`;
    const routeLabel = quoteActive ? `${objective.origin} -> ${objective.destination}` : "Market refreshed";
    const titleVerb = quoteActive ? "Deliver" : "Sell";

    panel.innerHTML = `
      <div class="objective-list compact-objective-list">
        <div class="objective-hud-card objective-trade-card compact-objective-card orbit-objective-card ${getCommodityRarityClass(objective.good)}">
          <div class="objective-main-row compact-objective-main objective-orbit-row">
            <div class="commodity-icon objective-icon objective-icon-large">
              <img src="${info.icon || getCommodityImage(objective.good)}" alt="${objective.good}" class="commodity-icon-img">
            </div>

            <div class="objective-copy objective-copy-large objective-orbit-copy">
              <div class="objective-title-line">
                <span class="objective-type-pill">Trade</span>
                <strong>${titleVerb} ${formatNumber(objective.maxUnits || held || 0)} ${objective.good}</strong>
              </div>
              <span>${routeLabel}</span>
              <em>${routeProgress}</em>
            </div>

            <div class="objective-orbit-meta">
              <span>${capacityText} cargo</span>
              <strong class="${potentialProfit >= 0 ? "profit-good" : "profit-bad"}">${profitText}</strong>
            </div>

            <div class="objective-compact-actions objective-orbit-actions">
              <button class="objective-map-btn" onclick="openSectorMap()">Jump</button>
              <button class="objective-abandon-btn" onclick="abandonTradeRoute()">Abandon</button>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (objective.type === "bounty") {
    const icon = getBountyObjectiveIcon(objective);
    panel.innerHTML = `
      <div class="objective-hud-card bounty-objective-card orbit-objective-card">
        <div class="objective-main-row objective-orbit-row">
          <div class="objective-bounty-icon image"><img src="${icon}" alt=""></div>
          <div class="objective-copy objective-orbit-copy">
            <div class="objective-title-line">
              <span class="objective-type-pill bounty-pill">Active Bounty</span>
              <strong>${objective.title}</strong>
            </div>
            <span>${objective.targetLabel}</span>
            <em>${getBountyObjectiveActionText(objective)}</em>
          </div>
          <div class="objective-orbit-meta">
            <span>${formatNumber(objective.kills)} / ${formatNumber(objective.killsRequired)} bots</span>
            <strong>CR ${formatNumber(objective.reward)}</strong>
          </div>
          <div class="objective-compact-actions objective-orbit-actions">
            <button class="objective-map-btn" onclick="openSectorMap()">Jump</button>
          </div>
        </div>
      </div>
    `;
  }
}

function findSectorRoute(start, destination) {
  if (!sectorNodes[start] || !sectorNodes[destination]) return [];
  if (start === destination) return [start];

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const nodeName = path[path.length - 1];
    const links = sectorNodes[nodeName]?.connects || [];

    for (const link of links) {
      if (visited.has(link)) continue;
      const nextPath = path.concat(link);
      if (link === destination) return nextPath;
      visited.add(link);
      queue.push(nextPath);
    }
  }

  return [];
}

function isNodeOnActiveTradeRoute(name) {
  const objective = getActiveObjective();
  if (objective?.type === "bounty" && isNodeInBountyArea(name, objective.targetArea)) return true;
  if (objective?.type === "trade" && getTradeObjectiveTargetNode(objective) === name) return true;
  const stagingPath = !objective ? getMultiplayerStagingBountyRoutePath() : [];
  return getObjectiveRoutePath(objective).includes(name) || stagingPath.includes(name);
}

function isLineOnActiveTradeRoute(a, b) {
  const path = getObjectiveRoutePath();
  const stagingPath = !getActiveObjective() ? getMultiplayerStagingBountyRoutePath() : [];
  const combinedPaths = [path, stagingPath].filter((entry) => entry.length > 1);
  for (const candidatePath of combinedPaths) {
    for (let i = 0; i < candidatePath.length - 1; i += 1) {
      if ((candidatePath[i] === a && candidatePath[i + 1] === b) || (candidatePath[i] === b && candidatePath[i + 1] === a)) return true;
    }
  }
  return false;
}

function getActiveTradeHudMarkup() {
  // Legacy shim retained for older UI references. Active objectives are now rendered by renderObjectiveHud().
  const objective = getActiveObjective();
  if (!objective || objective.type !== "trade") return "";
  if (objective.dailyTradeContract) {
    return `
      <div class="active-trade-hud-card contract-package-objective">
        <span class="active-trade-kicker">Courier Contract</span>
        <strong>${objective.packageName}</strong>
        <em>${getTradeObjectiveActionText(objective)}</em>
      </div>
    `;
  }
  return `
    <div class="active-trade-hud-card ${getCommodityRarityClass(objective.good)}">
      <span class="active-trade-kicker">Active Trade</span>
      <strong>${objective.good}</strong>
      <em>${getTradeObjectiveActionText(objective)}</em>
    </div>
  `;
}

function getMarketFlavorText(location) {
  if (location === "Virella") {
    return "A calm frontier exchange with strong common metal supply and lower industrial demand.";
  }

  if (location === "Nyxara") {
    return "A colder high-risk market where rare materials move quickly and margins can spike.";
  }

  return "A busy central trade terminal with balanced stock and strong demand from shipyards.";
}

function renderMarketCargoSummary() {
  const box = document.getElementById("marketCargoSummary");
  if (!box) return;

  const lines = mineralKeys
    .filter(good => cargo[good] > 0)
    .map(good => `<span>${good}: <strong>${formatNumber(cargo[good])}</strong></span>`);

  box.innerHTML = lines.length ? lines.join("") : "Empty";
}

function safeId(value) {
  return value.replace(/[^a-z0-9]/gi, "");
}

function clampNumber(value, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}


function renderTradeQuantityControls(good, mode, maxValue, defaultValue = 0, actionLabel = "Buy Cargo") {
  const id = safeId(good);
  const max = Math.max(0, Number(maxValue || 0));
  const value = clampNumber(defaultValue || 0, 0, max);
  const actionFn = mode === "sell" ? "sellGood" : "buyGood";
  const escapedGood = escapeJsString(good);
  const safeActionLabel = actionLabel;

  return `
    <div class="trade-quantity-panel">
      <div class="trade-qty-row">
        <label>${mode === "sell" ? "Sell Amount" : "Buy Amount"}</label>
        <span id="${mode}Summary-${id}" class="trade-summary-pill">${formatNumber(value)} units / CR 0</span>
      </div>
      <div class="trade-stepper-row">
        <button class="trade-step-btn" onclick="adjustTradeQuantity('${escapedGood}', '${mode}', -1)" ${max <= 0 ? "disabled" : ""}>-</button>
        <input
          id="${mode}Qty-${id}"
          class="qty-input trade-qty-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          max="${max}"
          value="${value}"
          oninput="syncTradeInput('${escapedGood}', '${mode}')"
        />
        <button class="trade-step-btn" onclick="adjustTradeQuantity('${escapedGood}', '${mode}', 1)" ${max <= 0 ? "disabled" : ""}>+</button>
        <button class="trade-quick-btn trade-amount-btn trade-max-btn" onclick="setTradeMax('${escapedGood}', '${mode}')" ${max <= 0 ? "disabled" : ""}>Max</button>
        <button id="${mode}Action-${id}" class="trade-primary-action" onclick="${actionFn}('${escapedGood}')" ${value <= 0 || max <= 0 ? "disabled" : ""}>${safeActionLabel}</button>
      </div>
    </div>
  `;
}

function adjustTradeQuantity(good, mode, delta) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  if (!qty) return;

  const max = parseInt(qty.max || "0", 10);
  qty.value = clampNumber((parseInt(qty.value || "0", 10) || 0) + delta, 0, max);
  if (mode === "buy" && Number(qty.value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function setTradeQuantityPercent(good, mode, percent) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  if (!qty) return;

  const max = parseInt(qty.max || "0", 10);
  qty.value = clampNumber(Math.floor(max * percent), 0, max);
  if (mode === "buy" && Number(qty.value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function getTradeQuantity(good, mode = "buy") {
  const id = safeId(good);
  const input = document.getElementById(`${mode}Qty-${id}`);
  const max = parseInt(input?.max || "0", 10);
  return clampNumber(input?.value || 0, 0, max);
}

function syncTradeInput(good, mode) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  const range = document.getElementById(`${mode}Range-${id}`);
  if (!qty && !range) return;

  const max = parseInt((qty?.max || range?.max || "0"), 10);
  const sourceValue = qty ? qty.value : range.value;
  const value = clampNumber(sourceValue, 0, max);
  if (qty) qty.value = value;
  if (range) range.value = value;

  if (mode === "buy" && Number(value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function setTradeMax(good, mode) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  const range = document.getElementById(`${mode}Range-${id}`);
  if (!qty && !range) return;

  const max = parseInt((qty?.max || range?.max || "0"), 10);
  if (qty) qty.value = max;
  if (range) range.value = max;

  if (mode === "buy" && max > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function updateTradePreview(good) {
  const id = safeId(good);
  const buyPrice = getEffectiveBuyPrice(good, currentNode);
  const sellPrice = getEffectiveSellPrice(good, currentNode);

  const buyRange = document.getElementById(`buyRange-${id}`);
  const buyQty = document.getElementById(`buyQty-${id}`);
  const buySummary = document.getElementById(`buySummary-${id}`);
  const buyRoi = document.getElementById(`buyRoi-${id}`);

  const sellRange = document.getElementById(`sellRange-${id}`);
  const sellQty = document.getElementById(`sellQty-${id}`);
  const sellSummary = document.getElementById(`sellSummary-${id}`);

  if ((buyRange || buyQty) && buySummary) {
    const maxBuy = parseInt((buyQty?.max || buyRange?.max || "0"), 10);
    const rawBuyValue = buyQty ? buyQty.value : buyRange.value;
    const buyAmount = clampNumber(rawBuyValue, 0, maxBuy);
    const investment = buyAmount * buyPrice;
    const activeTrade = getActiveTradePricing(good);
    const projectedSellPrice = activeTrade ? activeTrade.sellPrice : sellPrice;
    const projectedReturn = buyAmount * projectedSellPrice;
    const projectedProfit = projectedReturn - investment;
    const roiPercent = investment > 0 ? Math.round((projectedProfit / investment) * 100) : 0;

    if (buyRange) buyRange.value = buyAmount;
    if (buyQty) buyQty.value = buyAmount;
    const buyAction = document.getElementById(`buyAction-${id}`);
    if (buyAction) buyAction.disabled = buyAmount <= 0;
    buySummary.innerHTML = `${formatNumber(buyAmount)} units / <span class="mini-credit">CR</span>${formatNumber(investment)}`;

    if (buyRoi) {
      if (buyAmount > 0) {
        buyRoi.classList.remove("is-empty");
        buyRoi.innerHTML = `<span>Cost <strong><span class="mini-credit">CR</span>${formatNumber(investment)}</strong></span><span>Return <strong><span class="mini-credit">CR</span>${formatNumber(projectedReturn)}</strong></span><span>Profit <strong class="${projectedProfit >= 0 ? "profit-good" : "profit-bad"}">${projectedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(projectedProfit))}</strong></span><span>ROI <strong>${roiPercent}%</strong></span>`;
      } else {
        buyRoi.classList.add("is-empty");
        buyRoi.innerHTML = "";
      }
    }
  }

  if ((sellRange || sellQty) && sellSummary) {
    const maxSell = parseInt((sellQty?.max || sellRange?.max || "0"), 10);
    const rawSellValue = sellQty ? sellQty.value : sellRange.value;
    const sellAmount = clampNumber(rawSellValue, 0, maxSell);
    if (sellRange) sellRange.value = sellAmount;
    if (sellQty) sellQty.value = sellAmount;
    const sellAction = document.getElementById(`sellAction-${id}`);
    if (sellAction) sellAction.disabled = sellAmount <= 0;
    sellSummary.innerHTML = `${formatNumber(sellAmount)} units / <span class="mini-credit">CR</span>${formatNumber(sellAmount * sellPrice)}`;
  }
}

function getCurrentMarketStock() {
  if (!marketStock[currentNode]) {
    marketStock[currentNode] = {};
  }

  mineralKeys.forEach(good => {
    if (marketStock[currentNode][good] === undefined) {
      marketStock[currentNode][good] = 0;
    }
  });

  return marketStock[currentNode];
}

function buyGood(good) {
  const price = getEffectiveBuyPrice(good, currentNode);
  const quantity = getTradeQuantity(good, "buy");

  if (isMultiplayerStagingActive()) {
    const activeTrade = getActiveTradePricing(good);
    const offer = activeTrade?.origin === currentNode
      ? findMultiplayerStagingTradeOffer({
        good,
        origin: activeTrade.origin,
        destination: activeTrade.destination
      })
      : getMultiplayerStagingTradeOffers().find((entry) => {
        return isMultiplayerStagingOfferForResource(entry, good) &&
          normalizeTradeRouteValue(entry.buyNode) === normalizeTradeRouteValue(currentNode);
      });
    requestMultiplayerStagingTradeDryRun({
      operation: "buy",
      offerId: offer?.offerId || "",
      quantity: Math.max(1, quantity)
    });
    blockRealTradeMutationInMultiplayerStaging();
    return;
  }

  const availableCargo = getShipStats().cargo - cargoUsed();
  const affordableQuantity = Math.floor(credits / price);
  let routeRemaining = getShipStats().cargo || availableCargo;

  const activeTradeBeforeBuy = getActiveTradePricing(good);
  if (activeTradeBeforeBuy && activeTradeBeforeBuy.origin === currentNode) {
    const routeAllowance = Number(activeTradeBeforeBuy.maxUnits || getShipStats().cargo || 0);
    const alreadyPurchased = Number(activeTradeBeforeBuy.purchasedUnits || 0);
    routeRemaining = Math.max(0, routeAllowance - alreadyPurchased);
  }

  const maxBuy = Math.min(quantity, availableCargo, affordableQuantity, routeRemaining);

  if (maxBuy <= 0) {
    alert("Select a quantity first, or check credits, cargo space and the trade allowance.");
    return;
  }

  credits -= price * maxBuy;
  cargo[good] += maxBuy;

  const activeTrade = getActiveTradePricing(good);
  if (activeTrade && activeTrade.origin === currentNode) {
    updateActiveTradeProgress({
      purchasedUnits: Number(activeTrade.purchasedUnits || 0) + maxBuy,
      maxUnits: Number(activeTrade.maxUnits || getShipStats().cargo || 0)
    });
  }

  updatePurchasedCargoCostBasis(good, maxBuy, price);

  tutorialEvent("boughtTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}

function sellGood(good) {
  const price = getEffectiveSellPrice(good, currentNode);
  const quantity = getTradeQuantity(good, "sell");
  const maxSell = Math.min(quantity, cargo[good]);

  if (isMultiplayerStagingActive()) {
    const activeTrade = getActiveTradePricing(good);
    const offer = activeTrade?.destination === currentNode
      ? findMultiplayerStagingTradeOffer({
        good,
        origin: activeTrade.origin,
        destination: activeTrade.destination
      })
      : getMultiplayerStagingTradeOffers().find((entry) => {
        return isMultiplayerStagingOfferForResource(entry, good) &&
          normalizeTradeRouteValue(entry.sellNode) === normalizeTradeRouteValue(currentNode);
      });
    requestMultiplayerStagingTradeDryRun({
      operation: "sell",
      offerId: offer?.offerId || "",
      quantity: Math.max(1, maxSell || quantity)
    });
    blockRealTradeMutationInMultiplayerStaging();
    return;
  }

  if (maxSell <= 0) {
    alert(`Select a quantity first, or check your ${good} stock.`);
    return;
  }

  const activeTrade = getActiveTradePricing(good);
  const cargoUnitBasis = getCargoCostBasisForResource(good);
  const recoveredHeld = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(good) : (cargoUnitBasis === null ? maxSell : 0);
  const recoveredSold = Math.min(maxSell, recoveredHeld);
  const purchasedSold = Math.max(0, maxSell - recoveredSold);
  const recoveredCargoSale = recoveredSold > 0 && purchasedSold === 0;
  const unitCost = cargoUnitBasis || activeTrade?.buyPrice || price;
  const purchasedProfit = purchasedSold * (price - unitCost);
  const tradeProfit = recoveredCargoSale ? price * maxSell : (recoveredSold * price) + purchasedProfit;
  const saleProfit = purchasedSold > 0 && activeTrade && currentNode === activeTrade.destination
    ? Math.max(0, purchasedProfit)
    : 0;
  const saleRevenue = price * maxSell;

  if (typeof consumeRecoveredCargoQuantity === "function") consumeRecoveredCargoQuantity(good, recoveredSold);
  cargo[good] -= maxSell;
  credits += saleRevenue;
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + maxSell;

  if (recoveredSold > 0 && typeof addActivityLog === "function") {
    addActivityLog(`Recovered resource sale: sold ${formatNumber(recoveredSold)} ${good} at ${currentNode} for CR ${formatNumber(recoveredSold * price)} value.`);
  }

  showTradeResultBurst({
    good,
    quantity: maxSell,
    profit: tradeProfit,
    revenue: saleRevenue,
    valueMode: recoveredCargoSale,
    title: recoveredCargoSale ? "Recovered Cargo Sold" : "",
    detail: recoveredCargoSale ? `Sold ${formatNumber(maxSell)} ${good} at ${currentNode}` : ""
  });
  showTradeMiniFloat({ profit: tradeProfit });

  if (saleProfit > 0 && activeTrade) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTrade.realizedProfit || 0)) + saleProfit
    });
  }

  if ((cargo[good] || 0) <= 0 || getPurchasedCargoQuantity(good) <= 0) {
    delete cargoCostBasis[good];
    if (selectedLooseCargoSellGood === good) selectedLooseCargoSellGood = null;
  }

  if (purchasedSold > 0) completeActiveTradeIfReady(good);
  tutorialEvent("soldTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}


