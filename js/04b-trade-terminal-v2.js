/* Map 1 Trade Terminal V2: daily freight contracts + destination-free live market. */

const TRADE_MARKET_REFRESH_MS = 90000;
const LIVE_MARKET_BASE_PRICES = Object.freeze({
  "Asteron Prime": Object.freeze({ Iron: 18, Copper: 38, Cobalt: 90 }),
  Virella: Object.freeze({ Iron: 20, Copper: 50, Cobalt: 74 }),
  Nyxara: Object.freeze({ Iron: 30, Copper: 32, Cobalt: 128 })
});

const DAILY_TRADE_CONTRACT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "safe-delivery",
    name: "Safe Delivery",
    good: "Iron",
    origin: "Asteron Prime",
    destination: "Virella",
    quantity: 40,
    purchaseCost: 720,
    payout: 2200,
    profit: 1480,
    risk: "SAFE",
    riskTone: "safe",
    jumps: 1
  }),
  Object.freeze({
    id: "bulk-freight",
    name: "Bulk Freight",
    good: "Copper",
    origin: "Asteron Prime",
    destination: "Virella",
    quantity: 80,
    purchaseCost: 3040,
    payout: 5600,
    profit: 2560,
    risk: "SAFE",
    riskTone: "safe",
    jumps: 1
  }),
  Object.freeze({
    id: "priority-shipment",
    name: "Priority Shipment",
    good: "Cobalt",
    origin: "Virella",
    destination: "Nyxara",
    quantity: 50,
    purchaseCost: 3700,
    payout: 7000,
    profit: 3300,
    risk: "MODERATE",
    riskTone: "moderate",
    jumps: 2
  }),
  Object.freeze({
    id: "contested-run",
    name: "Contested Run",
    good: "Cobalt",
    origin: "Nyxara",
    destination: "Virella",
    quantity: 60,
    purchaseCost: 7680,
    payout: 12600,
    profit: 4920,
    risk: "HIGH",
    riskTone: "high",
    jumps: 2
  })
]);

function getMarketCycle() {
  return Math.floor(Date.now() / TRADE_MARKET_REFRESH_MS);
}

function getNextMarketRefreshSeconds() {
  return Math.max(0, Math.ceil(((getMarketCycle() + 1) * TRADE_MARKET_REFRESH_MS - Date.now()) / 1000));
}

function getLiveMarketPriceForCycle(good, planet, cycle = getMarketCycle()) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || !MAP_ONE_MARKET_PLANETS.includes(planet)) return 0;
  const base = Number(LIVE_MARKET_BASE_PRICES[planet]?.[good] || 1);
  const swing = (marketHash(String(cycle) + ":" + planet + ":" + good + ":live") % 17) - 8;
  return Math.max(1, Math.round(base * (1 + swing / 100)));
}

function getMapOneMarketPrice(good, planet) {
  return getLiveMarketPriceForCycle(good, planet, getMarketCycle());
}

function getLiveMarketPrice(good, planet) {
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const serverPrice = getMultiplayerStagingMarketPrice(good, planet, getCurrentMarketPlanet());
    if (Number.isFinite(Number(serverPrice)) && Number(serverPrice) > 0) return Number(serverPrice);
  }
  return getLiveMarketPriceForCycle(good, planet, getMarketCycle());
}

function getLiveMarketTrend(good, planet) {
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const currentPlanet = getCurrentMarketPlanet();
    const relevantOffer = planet === currentPlanet
      ? getMultiplayerStagingBuyOffersAt(currentPlanet).find((offer) => isMultiplayerStagingOfferForResource(offer, good))
      : findMultiplayerStagingTradeOffer({ good, origin: currentPlanet, destination: planet });
    const currentPrice = getLiveMarketPrice(good, planet);
    const previousPrice = planet === currentPlanet
      ? Number(relevantOffer?.previousBuyPrice || 0)
      : Number(relevantOffer?.previousSellPrice || 0);
    if (previousPrice > 0) return currentPrice > previousPrice ? "up" : currentPrice < previousPrice ? "down" : "stable";
  }
  const current = getLiveMarketPriceForCycle(good, planet, getMarketCycle());
  const previous = getLiveMarketPriceForCycle(good, planet, getMarketCycle() - 1);
  return current > previous ? "up" : current < previous ? "down" : "stable";
}

function getTradeCountdownLabel(seconds = getNextMarketRefreshSeconds()) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = String(Math.max(0, seconds) % 60).padStart(2, "0");
  return String(minutes).padStart(2, "0") + ":" + remainder;
}

function getDailyTradeDateKey(now = new Date()) {
  return typeof getDailyDateKey === "function" ? getDailyDateKey(now) : now.toISOString().slice(0, 10);
}

function createDailyTradeContract(definition) {
  return {
    ...definition,
    status: "available",
    acceptedAt: 0,
    loadedAt: 0,
    loadedQuantity: 0,
    completedAt: 0,
    completionEventId: "",
    dateKey: dailyTradeDate
  };
}

function normalizeDailyTradeContract(contract = {}) {
  const definition = DAILY_TRADE_CONTRACT_DEFINITIONS.find((entry) => entry.id === contract.id);
  if (!definition) return null;
  const status = ["available", "active", "complete"].includes(contract.status) ? contract.status : "available";
  return {
    ...definition,
    ...contract,
    status,
    loadedQuantity: Math.max(0, Math.min(definition.quantity, Math.round(Number(contract.loadedQuantity || 0)))),
    completionEventId: String(contract.completionEventId || "")
  };
}

function ensureDailyTradeContracts(now = new Date()) {
  const dateKey = getDailyTradeDateKey(now);
  const needsReset = dailyTradeDate !== dateKey || !Array.isArray(dailyTradeContracts) || dailyTradeContracts.length !== DAILY_TRADE_CONTRACT_DEFINITIONS.length;
  if (needsReset) {
    const previousActive = activeDailyTradeContractId;
    dailyTradeDate = dateKey;
    dailyTradeContracts = DAILY_TRADE_CONTRACT_DEFINITIONS.map(createDailyTradeContract);
    activeDailyTradeContractId = null;
    selectedDailyTradeContractId = dailyTradeContracts[0]?.id || null;
    if (previousActive && activeTradeRoute?.dailyTradeContract) clearActiveObjective("trade");
    return dailyTradeContracts;
  }

  dailyTradeContracts = dailyTradeContracts.map(normalizeDailyTradeContract).filter(Boolean);
  const active = dailyTradeContracts.find((contract) => contract.status === "active");
  activeDailyTradeContractId = active?.id || null;
  if (!selectedDailyTradeContractId || !dailyTradeContracts.some((contract) => contract.id === selectedDailyTradeContractId)) {
    selectedDailyTradeContractId = active?.id || dailyTradeContracts[0]?.id || null;
  }
  return dailyTradeContracts;
}

function getDailyTradeProgress() {
  ensureDailyTradeContracts();
  return dailyTradeContracts.filter((contract) => contract.status === "complete").length;
}

function getDailyTradeContract(id) {
  ensureDailyTradeContracts();
  return dailyTradeContracts.find((contract) => contract.id === id) || null;
}

function getSelectedDailyTradeContract() {
  ensureDailyTradeContracts();
  return getDailyTradeContract(selectedDailyTradeContractId) || dailyTradeContracts[0] || null;
}

function getReservedDailyContractCargo(good) {
  const contract = getDailyTradeContract(activeDailyTradeContractId);
  if (!contract || contract.status !== "active" || contract.good !== good) return 0;
  return Math.max(0, Number(contract.loadedQuantity || 0));
}

function getPurchasedCargoQuantity(good = "") {
  if (typeof getPurchasedCargoLedgerQuantity === "function") return getPurchasedCargoLedgerQuantity(good);
  const held = Math.max(0, Number(cargo[good] || 0));
  const recovered = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(good) : 0;
  return Math.max(0, held - recovered);
}

function updatePurchasedCargoCostBasis(good, quantity, price) {
  const boughtQuantity = Math.max(0, Math.round(Number(quantity || 0)));
  const unitPrice = Number(price || 0);
  if (!good || !boughtQuantity || !Number.isFinite(unitPrice) || unitPrice <= 0) return;
  const purchasedAfter = getPurchasedCargoQuantity(good);
  const purchasedBefore = Math.max(0, purchasedAfter - boughtQuantity);
  const previousBasis = Number(cargoCostBasis[good] || unitPrice);
  cargoCostBasis[good] = Math.round(((purchasedBefore * previousBasis) + (boughtQuantity * unitPrice)) / Math.max(1, purchasedAfter));
}

function setTradeTerminalStatus(message = "") {
  tradeTerminalStatusMessage = String(message || "");
  if (message && typeof addHudToast === "function") addHudToast(message);
}

function getTradeContractState(contract) {
  if (contract.status === "complete") return "complete";
  if (contract.status === "active") return "active";
  if (activeDailyTradeContractId && activeDailyTradeContractId !== contract.id) return "locked";
  return "available";
}

function acceptDailyTradeContract(id) {
  const contract = getDailyTradeContract(id);
  if (!contract || contract.status !== "available" || activeDailyTradeContractId) {
    setTradeTerminalStatus(activeDailyTradeContractId ? "Complete the active contract before accepting another." : "This contract is not available.");
    renderMarketplace();
    return false;
  }
  contract.status = "active";
  contract.acceptedAt = Date.now();
  contract.dateKey = dailyTradeDate;
  activeDailyTradeContractId = contract.id;
  selectedDailyTradeContractId = contract.id;
  setActiveTradeObjective({
    id: "daily-trade-" + dailyTradeDate + "-" + contract.id,
    type: "trade",
    title: contract.name,
    dailyTradeContract: true,
    contractId: contract.id,
    good: contract.good,
    origin: contract.origin,
    destination: contract.destination,
    buyPrice: Math.round(contract.purchaseCost / contract.quantity),
    sellPrice: Math.round(contract.payout / contract.quantity),
    profitPerUnit: contract.profit / contract.quantity,
    maxUnits: contract.quantity,
    purchasedUnits: 0,
    realizedProfit: 0,
    status: "active"
  });
  addActivityLog("Daily contract accepted: " + contract.name + " / " + contract.origin + " -> " + contract.destination + ".");
  setTradeTerminalStatus("Contract accepted. Load the fixed cargo at " + contract.origin + ".");
  saveGame();
  renderMarketplace();
  updateSpaceHUD();
  renderObjectiveHud();
  return true;
}

function loadDailyTradeContractCargo(id) {
  const contract = getDailyTradeContract(id);
  if (!contract || contract.status !== "active" || activeDailyTradeContractId !== id || contract.loadedQuantity > 0) return false;
  const planet = getCurrentMarketPlanet();
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  if (planet !== contract.origin) {
    setTradeTerminalStatus("Travel to " + contract.origin + " to load this contract.");
    renderMarketplace();
    return false;
  }
  if (credits < contract.purchaseCost || freeCargo < contract.quantity) {
    setTradeTerminalStatus(credits < contract.purchaseCost ? "Not enough credits for the fixed contract cost." : "Not enough cargo capacity for this contract.");
    renderMarketplace();
    return false;
  }
  credits -= contract.purchaseCost;
  cargo[contract.good] = Number(cargo[contract.good] || 0) + contract.quantity;
  addPurchasedCargoQuantity(contract.good, contract.quantity);
  updatePurchasedCargoCostBasis(contract.good, contract.quantity, contract.purchaseCost / contract.quantity);
  contract.loadedQuantity = contract.quantity;
  contract.loadedAt = Date.now();
  updateActiveTradeProgress({ purchasedUnits: contract.quantity, status: "loaded" });
  tutorialEvent("boughtTradeCargo");
  addActivityLog("Loaded " + formatNumber(contract.quantity) + " " + contract.good + " for " + contract.name + ".");
  setTradeTerminalStatus("Cargo loaded. Deliver it to " + contract.destination + " for the guaranteed payout.");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  renderObjectiveHud();
  return true;
}

function completeDailyTradeContract(id, eventId = "") {
  const contract = getDailyTradeContract(id);
  if (!contract || contract.status !== "active" || activeDailyTradeContractId !== id || contract.completionEventId) return false;
  const planet = getCurrentMarketPlanet();
  const purchased = getPurchasedCargoQuantity(contract.good);
  if (planet !== contract.destination || contract.loadedQuantity < contract.quantity || purchased < contract.quantity || Number(cargo[contract.good] || 0) < contract.quantity) {
    setTradeTerminalStatus(planet !== contract.destination ? "Travel to " + contract.destination + " to complete this delivery." : "The required contract cargo is not in your hold.");
    renderMarketplace();
    return false;
  }
  const completionKey = eventId || "daily-trade:" + dailyTradeDate + ":" + contract.id;
  contract.completionEventId = completionKey;
  contract.status = "complete";
  contract.completedAt = Date.now();
  contract.loadedQuantity = 0;
  consumePurchasedCargoQuantity(contract.good, contract.quantity);
  cargo[contract.good] = Math.max(0, Number(cargo[contract.good] || 0) - contract.quantity);
  if (getPurchasedCargoQuantity(contract.good) <= 0) delete cargoCostBasis[contract.good];
  credits += contract.payout;
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + contract.quantity;
  awardTradingXpFromProfit(contract.profit);
  activeDailyTradeContractId = null;
  clearActiveObjective("trade");
  tutorialEvent("soldTradeCargo");
  addActivityLog("Daily contract complete: " + contract.name + ". Guaranteed profit +CR " + formatNumber(contract.profit) + ".");
  showTradeResultBurst({
    good: contract.good,
    quantity: contract.quantity,
    profit: contract.profit,
    revenue: contract.payout,
    title: "Contract Complete",
    detail: contract.name
  });
  setTradeTerminalStatus(contract.name + " complete. Another daily contract is now available.");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  renderObjectiveHud();
  return true;
}

function selectDailyTradeContract(id) {
  if (!getDailyTradeContract(id)) return;
  selectedDailyTradeContractId = id;
  renderMarketplace();
}

function openDailyTradeContracts() {
  activeTradeTerminalTab = "contracts";
  ensureDailyTradeContracts();
  selectedDailyTradeContractId = activeDailyTradeContractId || selectedDailyTradeContractId || dailyTradeContracts[0]?.id || null;
  renderMarketplace();
}

function openLiveMarket() {
  activeTradeTerminalTab = "market";
  if (!MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource)) selectedMarketResource = "Iron";
  selectedMarketQuantity = 1;
  renderMarketplace();
}

function returnFromTradeTerminal() {
  if (activeTradeTerminalTab !== "overview") {
    activeTradeTerminalTab = "overview";
    renderMarketplace();
    return;
  }
  stopTradeTerminalTimer();
  returnToHub();
}

function setTradeTerminalTab(tabName) {
  if (tabName === "contracts") openDailyTradeContracts();
  else if (tabName === "market") openLiveMarket();
  else {
    activeTradeTerminalTab = "overview";
    renderMarketplace();
  }
}

function setMarketMode(mode) {
  selectedMarketMode = mode === "sell" ? "sell" : "buy";
  selectedMarketQuantity = 1;
  renderMarketplace();
}

function setMarketResource(good) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good)) return;
  selectedMarketResource = good;
  selectedMarketQuantity = 1;
  if (typeof shouldUseLocalTutorialTrade === "function" && shouldUseLocalTutorialTrade()) {
    activeTradeTerminalTab = "market";
    selectedMarketMode = "buy";
  }
  tutorialEvent("selectedMarketResource");
  renderMarketplace();
}

function getLiveMarketSellableQuantity(good = selectedMarketResource) {
  const held = Math.max(0, Number(cargo[good] || 0));
  return Math.max(0, held - getReservedDailyContractCargo(good));
}

function getMarketQuantityLimit() {
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  if (selectedMarketMode === "sell") return getLiveMarketSellableQuantity(good);
  const price = getLiveMarketPrice(good, planet);
  const affordable = price > 0 ? Math.floor(credits / price) : 0;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  return Math.max(0, Math.min(affordable, freeCargo, MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY));
}

function syncMarketQuantity(value) {
  const limit = getMarketQuantityLimit();
  selectedMarketQuantity = clampNumber(value, limit > 0 ? 1 : 0, Math.max(0, limit));
  if (selectedMarketMode === "buy" && selectedMarketQuantity > 0) tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function adjustMarketQuantity(delta) {
  syncMarketQuantity(Number(selectedMarketQuantity || 0) + Number(delta || 0));
}

function setMarketQuantityMax() {
  syncMarketQuantity(getMarketQuantityLimit());
}

function getOpenMarketStagingOffer(operation, good, planet) {
  if (operation === "sell") return findMultiplayerStagingSellOffer({ good, destination: planet });
  return getMultiplayerStagingBuyOffersAt(planet).find((offer) => isMultiplayerStagingOfferForResource(offer, good)) || null;
}

function buyMarketCargo() {
  if (marketBuyInProgress) return;
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  const limit = getMarketQuantityLimit();
  const quantity = clampNumber(selectedMarketQuantity, limit > 0 ? 1 : 0, Math.max(0, limit));
  const price = getLiveMarketPrice(good, planet);
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || quantity <= 0 || price <= 0) {
    setTradeTerminalStatus("Choose an affordable quantity with enough cargo space.");
    renderMarketplace();
    return;
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const offer = getOpenMarketStagingOffer("buy", good, planet);
    requestMultiplayerStagingTradeDryRun({ operation: "buy", offerId: offer?.offerId || "", quantity });
    return;
  }
  marketBuyInProgress = true;
  const totalCost = price * quantity;
  credits -= totalCost;
  cargo[good] = Number(cargo[good] || 0) + quantity;
  addPurchasedCargoQuantity(good, quantity);
  updatePurchasedCargoCostBasis(good, quantity, price);
  if (isLocalTutorialTradeActive() && good === TUTORIAL_TRADE_ROUTE.good && planet === TUTORIAL_TRADE_ROUTE.origin) {
    const destination = TUTORIAL_TRADE_ROUTE.destination;
    const sellPrice = getLiveMarketPrice(good, destination);
    setActiveTradeObjective({
      id: "tutorial-market-" + Date.now(),
      type: "trade",
      title: "First Trade Run",
      marketTrade: true,
      tutorialTrade: true,
      good,
      origin: planet,
      destination,
      buyPrice: price,
      sellPrice,
      profitPerUnit: sellPrice - price,
      maxUnits: quantity,
      purchasedUnits: quantity,
      realizedProfit: 0,
      status: "active"
    });
    renderObjectiveHud();
  }
  tutorialEvent("boughtTradeCargo");
  addActivityLog("Bought " + formatNumber(quantity) + " " + good + " at " + planet + " for CR " + formatNumber(totalCost) + ". No destination locked.");
  setTradeTerminalStatus("Cargo purchased at the current live price. Sell it at any Map 1 market.");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  marketBuyInProgress = false;
}

function sellMarketCargo() {
  if (marketSellInProgress) return;
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  const sellable = getLiveMarketSellableQuantity(good);
  const quantity = clampNumber(selectedMarketQuantity, sellable > 0 ? 1 : 0, sellable);
  const price = getLiveMarketPrice(good, planet);
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || quantity <= 0 || price <= 0) {
    setTradeTerminalStatus("No sellable " + good + " cargo is available.");
    renderMarketplace();
    return;
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const offer = getOpenMarketStagingOffer("sell", good, planet);
    requestMultiplayerStagingTradeDryRun({ operation: "sell", offerId: offer?.offerId || "", quantity });
    return;
  }

  marketSellInProgress = true;
  const purchasedBefore = getPurchasedCargoQuantity(good);
  const recoveredBefore = getRecoveredCargoQuantity(good);
  const purchasedSold = Math.min(quantity, purchasedBefore);
  const recoveredSold = Math.min(quantity - purchasedSold, recoveredBefore);
  const unitBasis = Number(getCargoCostBasisForResource(good) || price);
  const revenue = price * quantity;
  const purchasedProfit = purchasedSold * (price - unitBasis);
  consumePurchasedCargoQuantity(good, purchasedSold);
  consumeRecoveredCargoQuantity(good, recoveredSold);
  cargo[good] = Math.max(0, Number(cargo[good] || 0) - quantity);
  credits += revenue;
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + quantity;
  if (getPurchasedCargoQuantity(good) <= 0) delete cargoCostBasis[good];
  const tutorialRouteSale = Boolean(
    activeTradeRoute?.tutorialTrade &&
    activeTradeRoute.good === good &&
    activeTradeRoute.destination === planet
  );
  if (tutorialRouteSale) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTradeRoute.realizedProfit || 0)) + Math.max(0, purchasedProfit),
      purchasedUnits: Math.max(0, Number(activeTradeRoute.purchasedUnits || 0) - purchasedSold)
    });
  } else if (purchasedSold > 0 && purchasedProfit > 0) {
    awardTradingXpFromProfit(purchasedProfit);
  }
  if (recoveredSold > 0) addActivityLog("Recovered resource sale: sold " + formatNumber(recoveredSold) + " " + good + " at " + planet + ".");
  addActivityLog("Sold " + formatNumber(quantity) + " " + good + " at " + planet + " for CR " + formatNumber(revenue) + ".");
  const recoveredOnly = recoveredSold > 0 && purchasedSold === 0;
  showTradeResultBurst({
    good,
    quantity,
    profit: recoveredOnly ? revenue : purchasedProfit,
    revenue,
    valueMode: recoveredOnly,
    title: recoveredOnly ? "Recovered Cargo Sold" : "Trade Complete",
    detail: "Sold at " + planet
  });
  showTradeMiniFloat({ profit: recoveredOnly ? revenue : purchasedProfit });
  tutorialEvent("soldTradeCargo");
  if (tutorialRouteSale) completeActiveTradeIfReady(good);
  setTradeTerminalStatus("Sale complete at the current live price.");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  marketSellInProgress = false;
}

function applyMultiplayerStagingTradeObjective(_result) {
  // Live Market trades never create a destination objective. Daily Contracts own tracked routes.
}

function getTradeTrendMarkup(good, planet) {
  const trend = getLiveMarketTrend(good, planet);
  const symbol = trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
  const label = trend === "up" ? "rising" : trend === "down" ? "falling" : "stable";
  return `<span class="trade-v2-trend is-${trend}" aria-label="${escapeHtml(label)}">${symbol}</span>`;
}

function getTradeSummaryMarkup() {
  const completed = getDailyTradeProgress();
  const capacity = Math.max(1, Number(getShipStats().cargo || 1));
  const used = Math.max(0, Number(cargoUsed() || 0));
  const cargoPercent = Math.min(100, Math.round((used / capacity) * 100));
  return `
    <section class="trade-v2-summary" aria-label="Trade terminal summary">
      <div class="trade-v2-summary-item">
        <span class="trade-v2-summary-icon" aria-hidden="true">CR</span>
        <div><span>Credits</span><strong id="creditsText">${formatNumber(credits)} CR</strong></div>
      </div>
      <div class="trade-v2-summary-item">
        <span class="trade-v2-summary-icon" aria-hidden="true">▣</span>
        <div class="trade-v2-summary-copy"><span>Cargo Capacity</span><strong id="cargoText">${formatNumber(used)} / ${formatNumber(capacity)}</strong><i><b style="width:${cargoPercent}%"></b></i></div>
      </div>
      <div class="trade-v2-summary-item">
        <span class="trade-v2-summary-icon" aria-hidden="true">☷</span>
        <div><span>Daily Progress</span><strong>${completed} / 4 Complete</strong><small class="trade-v2-mini-dots">${DAILY_TRADE_CONTRACT_DEFINITIONS.map((_, index) => `<i class="${index < completed ? "is-complete" : ""}"></i>`).join("")}</small></div>
      </div>
      <div class="trade-v2-summary-item">
        <span class="trade-v2-summary-icon" aria-hidden="true">◷</span>
        <div><span>Market Refresh</span><strong id="marketCycleText" data-market-countdown>${getTradeCountdownLabel()}</strong></div>
      </div>
    </section>
  `;
}

function renderLiveMarketPriceTable({ interactive = false } = {}) {
  const currentPlanet = getCurrentMarketPlanet();
  return `
    <div class="trade-v2-table-wrap">
      <table class="trade-v2-market-table">
        <thead><tr><th scope="col">Commodity</th>${MAP_ONE_MARKET_PLANETS.map((planet) => `<th scope="col" class="${planet === currentPlanet ? "is-current" : ""}">${escapeHtml(planet)}</th>`).join("")}</tr></thead>
        <tbody>
          ${MAP_ONE_TRADE_RESOURCES.map((good) => {
            const info = commodityInfo[good] || {};
            const selected = interactive && good === selectedMarketResource;
            return `<tr
              class="${selected ? "is-selected" : ""}"
              ${good === "Iron" ? 'data-tutorial-target="marketResourceIron"' : ""}
              ${interactive ? `tabindex="0" role="button" aria-label="Select ${escapeHtml(good)}" onclick="setMarketResource('${escapeJsString(good)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setMarketResource('${escapeJsString(good)}');}"` : ""}>
              <th scope="row"><span class="trade-v2-commodity"><img src="${escapeHtml(info.icon || getCommodityImage(good))}" alt=""><strong>${escapeHtml(good)}</strong></span></th>
              ${MAP_ONE_MARKET_PLANETS.map((planet) => `<td class="${planet === currentPlanet ? "is-current" : ""}"><span>CR ${formatNumber(getLiveMarketPrice(good, planet))}</span>${getTradeTrendMarkup(good, planet)}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDailyTradePreviewRow(contract, index) {
  const state = getTradeContractState(contract);
  const stateLabel = state === "complete" ? "COMPLETE" : state === "active" ? "ACTIVE" : state === "locked" ? "LOCKED" : contract.risk;
  return `
    <article class="trade-v2-contract-preview is-${state}">
      <span class="trade-v2-contract-index">${index + 1}</span>
      <img src="${escapeHtml(getCommodityImage(contract.good))}" alt="">
      <div><strong>${escapeHtml(contract.name)}</strong><span>${escapeHtml(contract.origin)} <b>→</b> ${escapeHtml(contract.destination)}</span></div>
      <em class="risk-${contract.riskTone}">${stateLabel}</em>
      <strong class="trade-v2-profit">+${formatNumber(contract.profit)} CR</strong>
    </article>
  `;
}

function renderTradeOverview() {
  const completed = getDailyTradeProgress();
  return `
    <div class="trade-v2-view trade-v2-overview" data-trade-view="overview">
      ${getTradeSummaryMarkup()}
      <div class="trade-v2-primary-grid">
        <section class="trade-v2-primary-panel trade-v2-contracts-overview">
          <header class="trade-v2-panel-heading">
            <span class="trade-v2-panel-icon" aria-hidden="true">☷</span>
            <div><h3>Daily Contracts</h3><p>4 fixed contracts available each UTC day</p></div>
          </header>
          <div class="trade-v2-progress-line"><strong>${completed} / 4 Complete</strong><span>${DAILY_TRADE_CONTRACT_DEFINITIONS.map((_, index) => `<i class="${index < completed ? "is-complete" : ""}"></i>`).join("")}</span></div>
          <div class="trade-v2-contract-previews">${dailyTradeContracts.map(renderDailyTradePreviewRow).join("")}</div>
          <button type="button" class="trade-v2-open-button trade-v2-open-contracts" onclick="openDailyTradeContracts()">Open Contracts <span aria-hidden="true">›</span></button>
        </section>
        <section class="trade-v2-primary-panel trade-v2-market-overview">
          <header class="trade-v2-panel-heading">
            <span class="trade-v2-panel-icon" aria-hidden="true">⌁</span>
            <div><h3>Live Market</h3><p>Buy low. Sell high. Prices change fast.</p></div>
            <div class="trade-v2-panel-countdown"><span>Refresh in</span><strong data-market-countdown>${getTradeCountdownLabel()}</strong></div>
          </header>
          ${renderLiveMarketPriceTable()}
          <p class="trade-v2-market-note"><span aria-hidden="true">i</span> Purchased and recovered Iron, Copper and Cobalt can be sold here at current prices.</p>
          <button type="button" class="trade-v2-open-button trade-v2-open-market" onclick="openLiveMarket()">Open Market <span aria-hidden="true">›</span></button>
        </section>
      </div>
      <div class="trade-v2-status" role="status">${escapeHtml(tradeTerminalStatusMessage)}</div>
    </div>
  `;
}

function getDailyContractActionMarkup(contract) {
  const state = getTradeContractState(contract);
  if (state === "complete") return `<button type="button" class="trade-v2-contract-action is-complete" disabled>Contract Complete</button>`;
  if (state === "locked") return `<button type="button" class="trade-v2-contract-action" disabled title="Complete the active contract before accepting another.">Complete Active Contract First</button>`;
  if (state === "available") return `<button type="button" class="trade-v2-contract-action" onclick="acceptDailyTradeContract('${escapeJsString(contract.id)}')">Accept Contract</button>`;
  if (contract.loadedQuantity <= 0) {
    const atOrigin = getCurrentMarketPlanet() === contract.origin;
    const canLoad = atOrigin && credits >= contract.purchaseCost && Math.max(0, getShipStats().cargo - cargoUsed()) >= contract.quantity;
    const label = !atOrigin ? "Travel to " + contract.origin : credits < contract.purchaseCost ? "More Credits Required" : Math.max(0, getShipStats().cargo - cargoUsed()) < contract.quantity ? "More Cargo Space Required" : "Load Contract Cargo";
    return `<button type="button" class="trade-v2-contract-action" onclick="loadDailyTradeContractCargo('${escapeJsString(contract.id)}')" ${canLoad ? "" : "disabled"}>${escapeHtml(label)}</button>`;
  }
  const atDestination = getCurrentMarketPlanet() === contract.destination;
  return `<button type="button" class="trade-v2-contract-action" onclick="completeDailyTradeContract('${escapeJsString(contract.id)}')" ${atDestination ? "" : "disabled"}>${atDestination ? "Complete Delivery" : "Travel to " + escapeHtml(contract.destination)}</button>`;
}

function renderDailyContractCard(contract) {
  const state = getTradeContractState(contract);
  const selected = selectedDailyTradeContractId === contract.id;
  return `
    <button type="button" class="trade-v2-contract-card is-${state} ${selected ? "is-selected" : ""}" onclick="selectDailyTradeContract('${escapeJsString(contract.id)}')" aria-pressed="${selected}">
      <img src="${escapeHtml(getCommodityImage(contract.good))}" alt="">
      <div><strong>${escapeHtml(contract.name)}</strong><span>${escapeHtml(contract.origin)} → ${escapeHtml(contract.destination)}</span><small>${formatNumber(contract.quantity)} ${escapeHtml(contract.good)} · ${contract.jumps} ${contract.jumps === 1 ? "jump" : "jumps"}</small></div>
      <em class="risk-${contract.riskTone}">${state === "locked" ? "LOCKED" : state.toUpperCase()}</em>
      <b>+${formatNumber(contract.profit)} CR</b>
    </button>
  `;
}

function renderDailyContractsView() {
  const selected = getSelectedDailyTradeContract();
  const completed = getDailyTradeProgress();
  const state = selected ? getTradeContractState(selected) : "available";
  return `
    <div class="trade-v2-view trade-v2-dedicated" data-trade-view="contracts">
      ${getTradeSummaryMarkup()}
      <div class="trade-v2-dedicated-heading"><div><span>Daily Contracts</span><h3>Fixed terms. Guaranteed returns.</h3></div><strong>${completed} / 4 Complete · Reset ${formatBountyResetCountdown(getDailyResetSeconds())}</strong></div>
      <div class="trade-v2-contracts-grid">
        <section class="trade-v2-contract-list">${dailyTradeContracts.map(renderDailyContractCard).join("")}</section>
        <aside class="trade-v2-contract-detail">
          ${selected ? `
            <header><img src="${escapeHtml(getCommodityImage(selected.good))}" alt=""><div><span class="risk-${selected.riskTone}">${state.toUpperCase()}</span><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.origin)} → ${escapeHtml(selected.destination)}</p></div></header>
            <div class="trade-v2-detail-grid">
              <div><span>Cargo</span><strong>${escapeHtml(selected.good)}</strong></div>
              <div><span>Quantity</span><strong>${formatNumber(selected.quantity)}</strong></div>
              <div><span>Purchase Cost</span><strong>CR ${formatNumber(selected.purchaseCost)}</strong></div>
              <div><span>Delivery Payout</span><strong>CR ${formatNumber(selected.payout)}</strong></div>
              <div><span>Guaranteed Profit</span><strong class="profit-good">+CR ${formatNumber(selected.profit)}</strong></div>
              <div><span>Route</span><strong>${selected.jumps} ${selected.jumps === 1 ? "jump" : "jumps"} · ${escapeHtml(selected.risk)}</strong></div>
            </div>
            <p class="trade-v2-contract-guidance">${state === "locked" ? "Complete the active contract before accepting another." : state === "complete" ? "This contract has been completed for the current UTC day." : state === "active" && selected.loadedQuantity > 0 ? "Cargo loaded. Deliver the reserved shipment to " + escapeHtml(selected.destination) + "." : state === "active" ? "Load the complete fixed shipment at " + escapeHtml(selected.origin) + "." : "Accept to lock these terms for the current delivery."}</p>
            ${getDailyContractActionMarkup(selected)}
          ` : `<div class="trade-v2-empty">No daily contracts available.</div>`}
        </aside>
      </div>
      <div class="trade-v2-status" role="status">${escapeHtml(tradeTerminalStatusMessage)}</div>
    </div>
  `;
}

function renderLiveMarketTransactionPanel() {
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  const info = commodityInfo[good] || {};
  const purchased = getPurchasedCargoQuantity(good);
  const recovered = getRecoveredCargoQuantity(good);
  const reserved = getReservedDailyContractCargo(good);
  const sellable = getLiveMarketSellableQuantity(good);
  const price = getLiveMarketPrice(good, planet);
  const limit = getMarketQuantityLimit();
  const quantity = clampNumber(selectedMarketQuantity, limit > 0 ? 1 : 0, Math.max(0, limit));
  selectedMarketQuantity = quantity;
  const buying = selectedMarketMode !== "sell";
  const total = price * quantity;
  const disabled = quantity <= 0 || price <= 0;
  return `
    <aside class="trade-v2-transaction">
      <div class="trade-v2-mode-tabs" role="tablist" aria-label="Transaction type">
        <button type="button" role="tab" aria-selected="${buying}" class="${buying ? "is-active" : ""}" onclick="setMarketMode('buy')">Buy</button>
        <button type="button" role="tab" aria-selected="${!buying}" class="${!buying ? "is-active" : ""}" onclick="setMarketMode('sell')">Sell</button>
      </div>
      <header><img src="${escapeHtml(info.icon || getCommodityImage(good))}" alt=""><div><span>${buying ? "Buy at " : "Sell at "}${escapeHtml(planet)}</span><h3>${escapeHtml(good)}</h3><p>Current price <strong>CR ${formatNumber(price)}</strong> ${getTradeTrendMarkup(good, planet)}</p></div></header>
      <div class="trade-v2-cargo-ledgers">
        <div><span>Purchased</span><strong>${formatNumber(purchased)}</strong></div>
        <div><span>Recovered</span><strong>${formatNumber(recovered)}</strong></div>
        <div><span>${buying ? "Cargo Space" : "Sellable Total"}</span><strong>${buying ? formatNumber(Math.max(0, getShipStats().cargo - cargoUsed())) : formatNumber(sellable)}</strong></div>
      </div>
      ${reserved > 0 ? `<p class="trade-v2-reserved-note">${formatNumber(reserved)} ${escapeHtml(good)} reserved for the active Daily Contract.</p>` : ""}
      <div class="trade-v2-quantity">
        <div><span>Quantity</span><small>Maximum ${formatNumber(limit)}</small></div>
        <div class="trade-v2-stepper">
          <button type="button" aria-label="Decrease quantity" onclick="adjustMarketQuantity(-1)" ${limit <= 0 ? "disabled" : ""}>−</button>
          <input type="number" min="${limit > 0 ? 1 : 0}" max="${limit}" value="${quantity}" aria-label="${buying ? "Buy" : "Sell"} quantity" onchange="syncMarketQuantity(this.value)">
          <button type="button" aria-label="Increase quantity" onclick="adjustMarketQuantity(1)" ${limit <= 0 ? "disabled" : ""}>+</button>
          <button type="button" class="trade-v2-max" data-tutorial-target="marketMaxAmount" onclick="setMarketQuantityMax()" ${limit <= 0 ? "disabled" : ""}>Max</button>
        </div>
      </div>
      <div class="trade-v2-total"><span>${buying ? "Total Purchase Cost" : "Total Sale Value"}</span><strong>CR ${formatNumber(total)}</strong></div>
      <button type="button" class="trade-v2-transaction-action" data-tutorial-target="${buying ? "buyCargo" : "sellCargo"}" onclick="${buying ? "buyMarketCargo()" : "sellMarketCargo()"}" ${disabled ? "disabled" : ""}>${buying ? "Buy Cargo" : "Sell Cargo"}</button>
      <p class="trade-v2-transaction-note">${buying ? "No route is accepted and no destination is locked. Prices may change while you travel." : "Purchased and recovered cargo sell at the same current local price. Upgrade materials are excluded."}</p>
    </aside>
  `;
}

function renderLiveMarketView() {
  return `
    <div class="trade-v2-view trade-v2-dedicated" data-trade-view="market">
      ${getTradeSummaryMarkup()}
      <div class="trade-v2-dedicated-heading"><div><span>Live Market</span><h3>Buy freely. Travel freely. Sell at the current price.</h3></div><strong>Refresh in <span data-market-countdown>${getTradeCountdownLabel()}</span></strong></div>
      <div class="trade-v2-market-grid">
        <section class="trade-v2-market-board">
          ${renderLiveMarketPriceTable({ interactive: true })}
          <p class="trade-v2-market-note"><span aria-hidden="true">i</span> Iron, Copper and Cobalt only. Lupen Shards and Crystal Shards are not tradable.</p>
        </section>
        ${renderLiveMarketTransactionPanel()}
      </div>
      <div class="trade-v2-status" role="status">${escapeHtml(tradeTerminalStatusMessage)}</div>
    </div>
  `;
}

function renderMarketplace() {
  setupMultiplayerStagingTradeTerminalSubscription();
  requestMultiplayerStagingTradeOffersIfNeeded();
  ensureDailyTradeContracts();
  if (typeof reconcileTradeCargoLedgers === "function") reconcileTradeCargoLedgers();
  const planet = getCurrentMarketPlanet();
  const title = document.getElementById("marketLocationTitle");
  const flavor = document.getElementById("marketFlavorText");
  const body = document.getElementById("marketGoods");
  if (title) title.textContent = planet.toUpperCase();
  if (flavor) flavor.textContent = getMarketFlavorText(planet);
  if (!body) return;
  renderedMarketCycle = getMarketCycle();
  body.innerHTML = activeTradeTerminalTab === "contracts"
    ? renderDailyContractsView()
    : activeTradeTerminalTab === "market"
      ? renderLiveMarketView()
      : renderTradeOverview();
  updateTradeTimerDisplay();
}

function updateTradeTimerDisplay() {
  const countdown = getTradeCountdownLabel();
  document.querySelectorAll("[data-market-countdown]").forEach((element) => { element.textContent = countdown; });
  const cycleText = document.getElementById("marketCycleText");
  if (cycleText) cycleText.textContent = countdown;
  const dateBefore = dailyTradeDate;
  ensureDailyTradeContracts();
  const cycle = getMarketCycle();
  const marketOpen = document.getElementById("marketScreen")?.classList.contains("active");
  if (marketOpen && (cycle !== renderedMarketCycle || dateBefore !== dailyTradeDate)) {
    renderedMarketCycle = cycle;
    if (isMultiplayerStagingActive()) window.LupenMultiplayerClient?.requestStagingTradeOffers?.();
    renderMarketplace();
    if (dateBefore !== dailyTradeDate) saveGame();
  }
}
