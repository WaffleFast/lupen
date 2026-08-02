/* Map 1 Trade Terminal V2: daily freight contracts + destination-free live market. */

const TRADE_MARKET_REFRESH_MS = 180000;
const LIVE_MARKET_BASE_PRICES = Object.freeze({
  "Asteron Prime": Object.freeze({ Iron: 16, Copper: 34, Cobalt: 84 }),
  Virella: Object.freeze({ Iron: 23, Copper: 52, Cobalt: 70 }),
  Nyxara: Object.freeze({ Iron: 33, Copper: 30, Cobalt: 108 })
});

const DAILY_TRADE_CONTRACT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "safe-delivery",
    name: "Safe Delivery",
    packageId: "cryo-seed-vault",
    packageName: "Cryogenic Seed Vault",
    packageImage: "assets/trade-contracts/cryo-seed-vault.png",
    packageDescription: "A sealed botanical archive kept below freezing for frontier restoration work.",
    origin: "Asteron Prime",
    destination: "Virella",
    cargoSpace: 20,
    reward: 1480,
    risk: "SAFE",
    riskTone: "safe",
    jumps: 1
  }),
  Object.freeze({
    id: "bulk-freight",
    name: "Bulk Freight",
    packageId: "quantum-relay-core",
    packageName: "Quantum Relay Core",
    packageImage: "assets/trade-contracts/quantum-relay-core.png",
    packageDescription: "A calibrated relay assembly for restoring a long-range communications array.",
    origin: "Asteron Prime",
    destination: "Virella",
    cargoSpace: 35,
    reward: 2560,
    risk: "SAFE",
    riskTone: "safe",
    jumps: 1
  }),
  Object.freeze({
    id: "priority-shipment",
    name: "Priority Shipment",
    packageId: "diplomatic-cipher-case",
    packageName: "Diplomatic Cipher Case",
    packageImage: "assets/trade-contracts/diplomatic-cipher-case.png",
    packageDescription: "A tamper-proof diplomatic archive carrying time-sensitive encrypted records.",
    origin: "Virella",
    destination: "Nyxara",
    cargoSpace: 15,
    reward: 3300,
    risk: "MODERATE",
    riskTone: "moderate",
    jumps: 2
  }),
  Object.freeze({
    id: "contested-run",
    name: "Contested Run",
    packageId: "voidglass-specimen",
    packageName: "Voidglass Specimen",
    packageImage: "assets/trade-contracts/voidglass-specimen.png",
    packageDescription: "An unstable deep-space specimen secured inside a reinforced containment capsule.",
    origin: "Nyxara",
    destination: "Virella",
    cargoSpace: 30,
    reward: 4920,
    risk: "HIGH",
    riskTone: "high",
    jumps: 2
  })
]);

function beginTradeMarketWindow({ force = false, now = Date.now() } = {}) {
  const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const cycle = Math.floor(safeNow / TRADE_MARKET_REFRESH_MS);
  const startedAt = cycle * TRADE_MARKET_REFRESH_MS;
  if (!force && tradeMarketWindowStartedAt === startedAt && tradeMarketWindowCycle === cycle) {
    return {
      startedAt: tradeMarketWindowStartedAt,
      cycle: tradeMarketWindowCycle
    };
  }

  tradeMarketWindowStartedAt = startedAt;
  tradeMarketWindowCycle = cycle;
  return {
    startedAt: tradeMarketWindowStartedAt,
    cycle: tradeMarketWindowCycle
  };
}

function getMarketCycle(now = Date.now()) {
  const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return Math.floor(safeNow / TRADE_MARKET_REFRESH_MS);
}

function getNextMarketRefreshSeconds(now = Date.now()) {
  const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (typeof isMultiplayerStagingActive === "function" && isMultiplayerStagingActive()) {
    const serverExpiresAt = Number(window.LupenMultiplayerClient?.getStatus?.()?.lastStagingTradeOffers?.marketExpiresAt || 0);
    if (serverExpiresAt > safeNow) {
      return Math.max(0, Math.ceil((serverExpiresAt - safeNow) / 1000));
    }
  }
  const remaining = TRADE_MARKET_REFRESH_MS - (safeNow % TRADE_MARKET_REFRESH_MS);
  return Math.max(0, Math.ceil(remaining / 1000));
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

function getTutorialGuaranteedTradeSellPrice() {
  const buyPrice = getLiveMarketPriceForCycle(
    TUTORIAL_TRADE_ROUTE.good,
    TUTORIAL_TRADE_ROUTE.origin,
    getMarketCycle()
  );
  const liveSellPrice = getLiveMarketPriceForCycle(
    TUTORIAL_TRADE_ROUTE.good,
    TUTORIAL_TRADE_ROUTE.destination,
    getMarketCycle()
  );
  const minimumMargin = Math.max(4, Math.ceil(buyPrice * 0.2));
  return Math.max(liveSellPrice, buyPrice + minimumMargin);
}

function getLiveMarketPrice(good, planet) {
  if (
    activeTradeRoute?.tutorialTrade &&
    activeTradeRoute.good === good &&
    activeTradeRoute.destination === planet
  ) {
    return Math.max(
      getLiveMarketPriceForCycle(good, planet, getMarketCycle()),
      Number(activeTradeRoute.sellPrice || 0)
    );
  }
  if (
    isLocalTutorialTradeActive() &&
    good === TUTORIAL_TRADE_ROUTE.good &&
    planet === TUTORIAL_TRADE_ROUTE.destination
  ) {
    return getTutorialGuaranteedTradeSellPrice();
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const serverPrice = getMultiplayerStagingMarketPrice(good, planet, getCurrentMarketPlanet());
    if (Number.isFinite(Number(serverPrice)) && Number(serverPrice) > 0) return Number(serverPrice);
  }
  return getLiveMarketPriceForCycle(good, planet, getMarketCycle());
}

function getLiveMarketTrend(good, planet) {
  return "stable";
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
    packageLoaded: false,
    completedAt: 0,
    completionEventId: "",
    dateKey: dailyTradeDate
  };
}

function normalizeDailyTradeContract(contract = {}) {
  const definition = DAILY_TRADE_CONTRACT_DEFINITIONS.find((entry) => entry.id === contract.id);
  if (!definition) return null;
  const status = ["available", "active", "complete"].includes(contract.status) ? contract.status : "available";
  const legacyLoadedQuantity = Math.max(0, Math.round(Number(contract.loadedQuantity || 0)));
  const legacyGood = MAP_ONE_TRADE_RESOURCES.includes(contract.good) ? contract.good : "";
  return {
    ...definition,
    status,
    acceptedAt: Math.max(0, Number(contract.acceptedAt || 0)),
    loadedAt: Math.max(0, Number(contract.loadedAt || 0)),
    packageLoaded: status === "active" && Boolean(contract.packageLoaded || legacyLoadedQuantity > 0 || dailyTradeContractCargo?.contractId === contract.id),
    completedAt: Math.max(0, Number(contract.completedAt || 0)),
    dateKey: String(contract.dateKey || dailyTradeDate || ""),
    legacyGood,
    legacyLoadedQuantity,
    completionEventId: String(contract.completionEventId || "")
  };
}

function createDailyTradeContractCargo(contract) {
  if (!contract) return null;
  return {
    contractId: contract.id,
    packageId: contract.packageId,
    name: contract.packageName,
    image: contract.packageImage,
    description: contract.packageDescription,
    cargoSpace: Math.max(0, Number(contract.cargoSpace || 0)),
    origin: contract.origin,
    destination: contract.destination,
    loadedAt: Math.max(0, Number(contract.loadedAt || Date.now()))
  };
}

function createDailyTradeObjectivePayload(contract) {
  return {
    id: "daily-trade-" + dailyTradeDate + "-" + contract.id,
    type: "trade",
    title: contract.name,
    dailyTradeContract: true,
    contractId: contract.id,
    packageId: contract.packageId,
    packageName: contract.packageName,
    packageImage: contract.packageImage,
    cargoSpace: contract.cargoSpace,
    origin: contract.origin,
    destination: contract.destination,
    reward: contract.reward,
    maxUnits: 1,
    purchasedUnits: 1,
    realizedProfit: 0,
    status: "loaded"
  };
}

function normalizeDailyTradeContractCargo(value = dailyTradeContractCargo) {
  if (!value || typeof value !== "object") return null;
  const contract = dailyTradeContracts.find((entry) => entry.id === value.contractId && entry.status === "active");
  if (!contract) return null;
  return createDailyTradeContractCargo({ ...contract, loadedAt: value.loadedAt || contract.loadedAt });
}

function getDailyTradeContractCargo() {
  if (dailyTradeDate && dailyTradeDate !== getDailyTradeDateKey()) ensureDailyTradeContracts();
  dailyTradeContractCargo = normalizeDailyTradeContractCargo();
  return dailyTradeContractCargo;
}

function getDailyTradeContractCargoUsed() {
  return Math.max(0, Number(getDailyTradeContractCargo()?.cargoSpace || 0));
}

function removeLegacyDailyTradeCommodity(contract) {
  const good = contract?.legacyGood;
  const quantity = Math.max(0, Number(contract?.legacyLoadedQuantity || 0));
  if (!good || !quantity) return;
  const amount = Math.min(quantity, Math.max(0, Number(cargo[good] || 0)));
  if (!amount) return;
  if (typeof consumePurchasedCargoQuantity === "function") consumePurchasedCargoQuantity(good, amount);
  cargo[good] = Math.max(0, Number(cargo[good] || 0) - amount);
  if (typeof getPurchasedCargoQuantity === "function" && getPurchasedCargoQuantity(good) <= 0) delete cargoCostBasis[good];
}

function ensureDailyTradeContracts(now = new Date()) {
  const dateKey = getDailyTradeDateKey(now);
  const needsReset = dailyTradeDate !== dateKey || !Array.isArray(dailyTradeContracts) || dailyTradeContracts.length !== DAILY_TRADE_CONTRACT_DEFINITIONS.length;
  if (needsReset) {
    const previousActive = activeDailyTradeContractId;
    dailyTradeDate = dateKey;
    dailyTradeContracts = DAILY_TRADE_CONTRACT_DEFINITIONS.map(createDailyTradeContract);
    activeDailyTradeContractId = null;
    dailyTradeContractCargo = null;
    selectedDailyTradeContractId = dailyTradeContracts[0]?.id || null;
    if (previousActive && activeTradeRoute?.dailyTradeContract) clearActiveObjective("trade");
    return dailyTradeContracts;
  }

  dailyTradeContracts = dailyTradeContracts.map(normalizeDailyTradeContract).filter(Boolean);
  const active = dailyTradeContracts.find((contract) => contract.status === "active");
  activeDailyTradeContractId = active?.id || null;
  if (active?.packageLoaded) {
    if (!dailyTradeContractCargo) {
      removeLegacyDailyTradeCommodity(active);
      dailyTradeContractCargo = createDailyTradeContractCargo(active);
    }
    dailyTradeContractCargo = normalizeDailyTradeContractCargo();
    if (!activeTradeRoute?.dailyTradeContract || activeTradeRoute.contractId !== active.id || activeTradeRoute.packageId !== active.packageId) {
      setActiveTradeObjective(createDailyTradeObjectivePayload(active));
    }
  } else {
    dailyTradeContractCargo = null;
  }
  dailyTradeContracts.forEach((contract) => {
    delete contract.legacyGood;
    delete contract.legacyLoadedQuantity;
  });
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
  const planet = getCurrentMarketPlanet();
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  if (planet !== contract.origin) {
    setTradeTerminalStatus("This package can only be collected at " + contract.origin + ".");
    renderMarketplace();
    return false;
  }
  if (freeCargo < contract.cargoSpace) {
    setTradeTerminalStatus("Free " + formatNumber(contract.cargoSpace) + " cargo space before accepting this contract.");
    renderMarketplace();
    return false;
  }
  contract.status = "active";
  contract.acceptedAt = Date.now();
  contract.loadedAt = Date.now();
  contract.packageLoaded = true;
  contract.dateKey = dailyTradeDate;
  activeDailyTradeContractId = contract.id;
  selectedDailyTradeContractId = contract.id;
  dailyTradeContractCargo = createDailyTradeContractCargo(contract);
  setActiveTradeObjective(createDailyTradeObjectivePayload(contract));
  addActivityLog("Contract package collected: " + contract.packageName + " / " + contract.origin + " -> " + contract.destination + ".");
  setTradeTerminalStatus(contract.packageName + " loaded. Deliver it to " + contract.destination + ".");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  renderObjectiveHud();
  return true;
}

function loadDailyTradeContractCargo(id) {
  const contract = getDailyTradeContract(id);
  if (!contract) return false;
  if (contract.status === "available") return acceptDailyTradeContract(id);
  return contract.status === "active" && contract.packageLoaded && dailyTradeContractCargo?.contractId === id;
}

function completeDailyTradeContract(id, eventId = "") {
  const contract = getDailyTradeContract(id);
  if (!contract || contract.status !== "active" || activeDailyTradeContractId !== id || contract.completionEventId) return false;
  const planet = getCurrentMarketPlanet();
  const packageCargo = getDailyTradeContractCargo();
  if (planet !== contract.destination || !contract.packageLoaded || packageCargo?.contractId !== contract.id) {
    setTradeTerminalStatus(planet !== contract.destination ? "Travel to " + contract.destination + " to complete this delivery." : "The sealed contract package is not in your hold.");
    renderMarketplace();
    return false;
  }
  const completionKey = eventId || "daily-trade:" + dailyTradeDate + ":" + contract.id;
  contract.completionEventId = completionKey;
  contract.status = "complete";
  contract.completedAt = Date.now();
  contract.packageLoaded = false;
  dailyTradeContractCargo = null;
  credits += contract.reward;
  awardTradingXpFromProfit(contract.reward);
  activeDailyTradeContractId = null;
  clearActiveObjective("trade");
  addActivityLog("Daily contract complete: " + contract.name + ". Courier reward +CR " + formatNumber(contract.reward) + ".");
  showTradeResultBurst({
    good: contract.packageName,
    quantity: 1,
    profit: contract.reward,
    revenue: contract.reward,
    title: "Contract Complete",
    detail: contract.packageName
  });
  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("complete_daily_trade_contract", {
      contractId: contract.id,
      completionEventId: completionKey,
      origin: contract.origin,
      destination: contract.destination,
      reward: contract.reward
    });
  }
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
  activeTradeTerminalTab = "overview";
  tradeContractsExpanded = true;
  ensureDailyTradeContracts();
  selectedDailyTradeContractId = activeDailyTradeContractId || selectedDailyTradeContractId || dailyTradeContracts[0]?.id || null;
  renderMarketplace();
}

function toggleDailyTradeContracts() {
  tradeContractsExpanded = !tradeContractsExpanded;
  if (tradeContractsExpanded) {
    ensureDailyTradeContracts();
    selectedDailyTradeContractId = activeDailyTradeContractId || selectedDailyTradeContractId || dailyTradeContracts[0]?.id || null;
  }
  renderMarketplace();
  if (typeof tutorialEvent === "function") {
    tutorialEvent(tradeContractsExpanded ? "openedDailyTradeContracts" : "closedDailyTradeContracts");
  }
  requestAnimationFrame(() => {
    document.querySelector(tradeContractsExpanded ? ".trade-v2-contract-drawer-close" : ".trade-v2-contract-strip-button")?.focus();
  });
}

function openLiveMarket() {
  activeTradeTerminalTab = "overview";
  tradeContractsExpanded = false;
  if (!MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource)) selectedMarketResource = "Iron";
  selectedMarketMode = "buy";
  selectedMarketQuantity = Math.max(1, Number(selectedMarketQuantity || 1));
  renderMarketplace();
}

function returnFromTradeTerminal() {
  activeTradeTerminalTab = "overview";
  tradeContractsExpanded = false;
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
  selectedMarketMode = "buy";
  selectedMarketQuantity = 1;
  ensureLiveMarketTargetPlanet(good);
  if (typeof shouldUseLocalTutorialTrade === "function" && shouldUseLocalTutorialTrade()) {
    activeTradeTerminalTab = "overview";
  }
  tutorialEvent("selectedMarketResource");
  renderMarketplace();
}

function setLiveMarketSelection(good, planet, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || !MAP_ONE_MARKET_PLANETS.includes(planet)) return;
  selectedMarketResource = good;
  selectedMarketMode = "buy";
  if (planet !== getCurrentMarketPlanet()) {
    selectedMarketTargetPlanet = planet;
    tutorialEvent("selectedMarketTarget");
  }
  selectedMarketQuantity = clampNumber(selectedMarketQuantity || 1, getMarketQuantityLimit("buy") > 0 ? 1 : 0, Math.max(0, getMarketQuantityLimit("buy")));
  tutorialEvent("selectedMarketResource");
  renderMarketplace();
}

function reviewTutorialMarketPrice(priceKind, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const expectedStepId = priceKind === "sell" ? "review-market-sell-price" : "review-market-buy-price";
  if (
    typeof tutorialState !== "undefined" &&
    tutorialState?.active &&
    getCurrentTutorialStep?.()?.id === expectedStepId
  ) {
    tutorialEvent(priceKind === "sell" ? "reviewedTutorialSellPrice" : "reviewedTutorialBuyPrice");
    return;
  }
  setMarketResource(TUTORIAL_TRADE_ROUTE.good);
}

function getLiveMarketSellableQuantity(good = selectedMarketResource) {
  return Math.max(0, Number(cargo[good] || 0));
}

function getMarketQuantityLimit(operation = "buy") {
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  if (operation === "sell") return getLiveMarketSellableQuantity(good);
  const price = getLiveMarketPrice(good, planet);
  const affordable = price > 0 ? Math.floor(credits / price) : 0;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const target = ensureLiveMarketTargetPlanet(good, planet);
  const stagingLimit = isMultiplayerStagingActive() && !isLocalTutorialTradeActive() && typeof getMultiplayerStagingTradeQuantityLimit === "function"
    ? getMultiplayerStagingTradeQuantityLimit({ operation: "buy", good, origin: planet, destination: target })
    : MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY;
  return Math.max(0, Math.min(affordable, freeCargo, stagingLimit));
}

function syncMarketQuantity(value) {
  const limit = getMarketQuantityLimit("buy");
  selectedMarketQuantity = clampNumber(value, limit > 0 ? 1 : 0, Math.max(0, limit));
  if (selectedMarketQuantity > 0) tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function adjustMarketQuantity(delta) {
  syncMarketQuantity(Number(selectedMarketQuantity || 0) + Number(delta || 0));
}

function setMarketQuantityMax() {
  syncMarketQuantity(getMarketQuantityLimit("buy"));
}

function getOpenMarketStagingOffer(operation, good, planet) {
  if (operation === "sell") return findMultiplayerStagingSellOffer({ good, destination: planet });
  return getMultiplayerStagingBuyOffersAt(planet).find((offer) => isMultiplayerStagingOfferForResource(offer, good)) || null;
}

function getMarketTargetOptions(origin = getCurrentMarketPlanet()) {
  return MAP_ONE_MARKET_PLANETS.filter((planet) => planet !== origin);
}

function getOrderedLiveMarketPlanets(currentPlanet = getCurrentMarketPlanet()) {
  if (!MAP_ONE_MARKET_PLANETS.includes(currentPlanet)) return MAP_ONE_MARKET_PLANETS;
  return [currentPlanet, ...MAP_ONE_MARKET_PLANETS.filter((planet) => planet !== currentPlanet)];
}

function getAvailableLiveMarketTargetOptions(good = selectedMarketResource, origin = getCurrentMarketPlanet()) {
  const baseOptions = getMarketTargetOptions(origin);
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive() && typeof getMultiplayerStagingTargetPlanetsForResource === "function") {
    const stagingTargets = getMultiplayerStagingTargetPlanetsForResource(good, origin)
      .filter((planet) => baseOptions.includes(planet));
    if (stagingTargets.length) return stagingTargets;
  }
  return baseOptions;
}

function getBestLiveMarketTargetPlanet(good = selectedMarketResource, origin = getCurrentMarketPlanet()) {
  const options = getAvailableLiveMarketTargetOptions(good, origin);
  if (!options.length) return "";
  if (activeTradeRoute?.marketTrade && activeTradeRoute.good === good && options.includes(activeTradeRoute.destination)) {
    return activeTradeRoute.destination;
  }
  return options
    .map((planet) => ({ planet, price: getLiveMarketPrice(good, planet) }))
    .sort((a, b) => b.price - a.price || a.planet.localeCompare(b.planet))[0]?.planet || options[0];
}

function ensureLiveMarketTargetPlanet(good = selectedMarketResource, origin = getCurrentMarketPlanet()) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good)) good = MAP_ONE_TRADE_RESOURCES[0];
  const options = getAvailableLiveMarketTargetOptions(good, origin);
  if (!options.includes(selectedMarketTargetPlanet) || selectedMarketTargetPlanet === origin) {
    selectedMarketTargetPlanet = getBestLiveMarketTargetPlanet(good, origin);
  }
  return selectedMarketTargetPlanet;
}

function getSelectedLiveMarketRouteQuote(good = selectedMarketResource) {
  const origin = getCurrentMarketPlanet();
  const destination = ensureLiveMarketTargetPlanet(good, origin);
  const buyPrice = getLiveMarketPrice(good, origin);
  const sellPrice = destination ? getLiveMarketPrice(good, destination) : 0;
  const unitProfit = sellPrice - buyPrice;
  return { origin, destination, buyPrice, sellPrice, unitProfit };
}

function getLiveMarketRouteOffer(good = selectedMarketResource, destination = selectedMarketTargetPlanet) {
  if (!isMultiplayerStagingActive() || isLocalTutorialTradeActive()) return null;
  return findMultiplayerStagingTradeOffer({
    good,
    origin: getCurrentMarketPlanet(),
    destination
  });
}

function buyMarketCargo() {
  if (marketBuyInProgress) return;
  const good = selectedMarketResource;
  const planet = getCurrentMarketPlanet();
  const target = ensureLiveMarketTargetPlanet(good, planet);
  const quote = getSelectedLiveMarketRouteQuote(good);
  const limit = getMarketQuantityLimit("buy");
  const quantity = clampNumber(selectedMarketQuantity, limit > 0 ? 1 : 0, Math.max(0, limit));
  const price = quote.buyPrice;
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || quantity <= 0 || price <= 0) {
    const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
    setTradeTerminalStatus(freeCargo <= 0 ? "Cargo hold full." : credits < price ? "Not enough credits." : "Choose a valid purchase quantity.");
    renderMarketplace();
    return;
  }
  if (!target || target === planet) {
    setTradeTerminalStatus("Select another station as the sell target before purchasing cargo.");
    renderMarketplace();
    return;
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const offer = getLiveMarketRouteOffer(good, target);
    if (!offer) {
      setTradeTerminalStatus("That route is not currently available.");
      renderMarketplace();
      return;
    }
    requestMultiplayerStagingTradeDryRun({ operation: "buy", offerId: offer?.offerId || "", quantity });
    return;
  }
  marketBuyInProgress = true;
  const totalCost = price * quantity;
  credits -= totalCost;
  cargo[good] = Number(cargo[good] || 0) + quantity;
  addPurchasedCargoQuantity(good, quantity);
  updatePurchasedCargoCostBasis(good, quantity, price);
  const tutorialTrade = isLocalTutorialTradeActive() && good === TUTORIAL_TRADE_ROUTE.good && planet === TUTORIAL_TRADE_ROUTE.origin;
  const destination = tutorialTrade ? TUTORIAL_TRADE_ROUTE.destination : target;
  const sellPrice = tutorialTrade ? Math.max(getLiveMarketPrice(good, destination), price + 1) : quote.sellPrice;
  setActiveTradeObjective({
    id: tutorialTrade ? "tutorial-market-" + Date.now() : `market-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type: "trade",
    title: tutorialTrade ? "First Trade Run" : `${good} Trade`,
    marketTrade: true,
    tutorialTrade,
    good,
    origin: planet,
    destination,
    buyPrice: price,
    sellPrice,
    profitPerUnit: sellPrice - price,
    maxUnits: quantity,
    purchasedUnits: quantity,
    realizedProfit: 0,
    acceptedAtCycle: getMarketCycle(),
    status: "active"
  });
  renderObjectiveHud();
  tutorialEvent("boughtTradeCargo");
  addActivityLog("Trade accepted: " + planet + " -> " + destination + ". Bought " + formatNumber(quantity) + " " + good + " for CR " + formatNumber(totalCost) + ".");
  setTradeTerminalStatus("Cargo purchased. Deliver " + good + " to " + destination + " before market refresh.");
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
  const quantity = sellable;
  const price = getLiveMarketPrice(good, planet);
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || quantity <= 0 || price <= 0) {
    setTradeTerminalStatus("No sellable " + good + " cargo is available.");
    renderMarketplace();
    return;
  }
  if (isMultiplayerStagingActive() && !isLocalTutorialTradeActive()) {
    const offer = getOpenMarketStagingOffer("sell", good, planet);
    if (!offer) {
      setTradeTerminalStatus("No buyer is available for " + good + " at " + planet + ".");
      renderMarketplace();
      return;
    }
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
  const routeSale = Boolean(
    activeTradeRoute?.marketTrade &&
    activeTradeRoute.good === good &&
    activeTradeRoute.destination === planet
  );
  if (routeSale) {
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
  if (routeSale) completeActiveTradeIfReady(good);
  setTradeTerminalStatus("Sale complete at the current live price.");
  saveGame();
  renderMarketplace();
  if (
    typeof tutorialState !== "undefined" &&
    tutorialState?.active &&
    typeof renderStarterTutorial === "function"
  ) {
    renderStarterTutorial();
  }
  updateCargoSummary();
  updateSpaceHUD();
  marketSellInProgress = false;
}

function getTradeTrendMarkup(good, planet) {
  return "";
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

function renderLiveMarketPriceCell(good, planet, currentPlanet, interactive = false) {
  const isTarget = interactive && good === selectedMarketResource && planet === selectedMarketTargetPlanet && planet !== currentPlanet;
  const isCurrent = planet === currentPlanet;
  const priceMarkup = `<span>CR ${formatNumber(getLiveMarketPrice(good, planet))}</span>${getTradeTrendMarkup(good, planet)}`;
  const tutorialPriceKind = good === TUTORIAL_TRADE_ROUTE.good && planet === TUTORIAL_TRADE_ROUTE.origin
    ? "buy"
    : good === TUTORIAL_TRADE_ROUTE.good && planet === TUTORIAL_TRADE_ROUTE.destination
      ? "sell"
      : "";
  const tutorialTarget = tutorialPriceKind === "buy" ? "marketBuyPrice" : "marketSellPrice";
  const clickHandler = interactive && tutorialPriceKind
    ? `reviewTutorialMarketPrice('${tutorialPriceKind}', event); setLiveMarketSelection('${escapeJsString(good)}', '${escapeJsString(planet)}', event);`
    : `setLiveMarketSelection('${escapeJsString(good)}', '${escapeJsString(planet)}', event)`;
  const content = interactive
    ? `<button type="button" class="trade-v2-price-cell-button ${isTarget ? "is-target" : ""}" ${tutorialPriceKind ? `data-tutorial-target="${tutorialTarget}"` : ""} aria-pressed="${isTarget}" aria-label="${isCurrent ? "Buy here: " + escapeHtml(good) + " at " + escapeHtml(planet) : "Target " + escapeHtml(planet) + " sell price for " + escapeHtml(good)}" onclick="${clickHandler}">${priceMarkup}<small>${isCurrent ? "Buy Here" : isTarget ? "Selected Sell Target" : "Sell Target"}</small></button>`
    : priceMarkup;
  return `<td class="${isCurrent ? "is-current" : ""} ${isTarget ? "is-target" : ""}">${content}</td>`;
}

function renderLiveMarketPriceTable({ interactive = false } = {}) {
  const currentPlanet = getCurrentMarketPlanet();
  const orderedPlanets = getOrderedLiveMarketPlanets(currentPlanet);
  return `
    <div class="trade-v2-table-wrap">
      <table class="trade-v2-market-table">
        <thead><tr><th scope="col">Commodity</th>${orderedPlanets.map((planet) => `<th scope="col" class="${planet === currentPlanet ? "is-current" : ""}">${planet === currentPlanet ? `<span class="trade-v2-current-station-marker" aria-hidden="true">&#8982;</span>${escapeHtml(planet)} <small>Current Station</small>` : escapeHtml(planet)}</th>`).join("")}</tr></thead>
        <tbody>
          ${MAP_ONE_TRADE_RESOURCES.map((good) => {
            const info = commodityInfo[good] || {};
            const selected = interactive && good === selectedMarketResource;
            return `<tr
              class="${selected ? "is-selected" : ""}"
              ${good === "Iron" ? 'data-tutorial-target="marketResourceIron"' : ""}
              ${interactive ? `tabindex="0" role="button" aria-label="Select ${escapeHtml(good)}" onclick="setMarketResource('${escapeJsString(good)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setMarketResource('${escapeJsString(good)}');}"` : ""}>
              <th scope="row"><span class="trade-v2-commodity"><img src="${escapeHtml(info.icon || getCommodityImage(good))}" alt=""><strong>${escapeHtml(good)}</strong></span></th>
              ${orderedPlanets.map((planet) => renderLiveMarketPriceCell(good, planet, currentPlanet, interactive)).join("")}
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
      <img src="${escapeHtml(contract.packageImage)}" alt="">
      <div><strong>${escapeHtml(contract.name)}</strong><span>${escapeHtml(contract.origin)} <b>→</b> ${escapeHtml(contract.destination)}</span></div>
      <em class="risk-${contract.riskTone}">${stateLabel}</em>
      <strong class="trade-v2-profit">+${formatNumber(contract.reward)} CR</strong>
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
  if (state === "available") {
    const atOrigin = getCurrentMarketPlanet() === contract.origin;
    const hasSpace = Math.max(0, getShipStats().cargo - cargoUsed()) >= contract.cargoSpace;
    const label = !atOrigin ? "Start at " + contract.origin : !hasSpace ? "Need " + formatNumber(contract.cargoSpace) + " Cargo Space" : "Accept & Load";
    return `<button type="button" class="trade-v2-contract-action" onclick="acceptDailyTradeContract('${escapeJsString(contract.id)}')" ${atOrigin && hasSpace ? "" : "disabled"}>${escapeHtml(label)}</button>`;
  }
  const atDestination = getCurrentMarketPlanet() === contract.destination;
  return `<button type="button" class="trade-v2-contract-action" onclick="completeDailyTradeContract('${escapeJsString(contract.id)}')" ${atDestination ? "" : "disabled"}>${atDestination ? "Complete Delivery" : "Travel to " + escapeHtml(contract.destination)}</button>`;
}

function renderDailyContractCard(contract) {
  const state = getTradeContractState(contract);
  const selected = selectedDailyTradeContractId === contract.id;
  return `
    <button type="button" class="trade-v2-contract-card is-${state} ${selected ? "is-selected" : ""}" onclick="selectDailyTradeContract('${escapeJsString(contract.id)}')" aria-pressed="${selected}">
      <img src="${escapeHtml(contract.packageImage)}" alt="">
      <div><strong>${escapeHtml(contract.name)}</strong><span>${escapeHtml(contract.origin)} → ${escapeHtml(contract.destination)}</span><small>${escapeHtml(contract.packageName)} · ${formatNumber(contract.cargoSpace)} cargo</small></div>
      <em class="risk-${contract.riskTone}">${state === "locked" ? "LOCKED" : state.toUpperCase()}</em>
      <b>+${formatNumber(contract.reward)} CR</b>
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
            <header><img src="${escapeHtml(selected.packageImage)}" alt=""><div><span class="risk-${selected.riskTone}">${state.toUpperCase()}</span><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.origin)} → ${escapeHtml(selected.destination)}</p></div></header>
            <div class="trade-v2-detail-grid">
              <div><span>Package</span><strong>${escapeHtml(selected.packageName)}</strong></div>
              <div><span>Cargo Space</span><strong>${formatNumber(selected.cargoSpace)}</strong></div>
              <div><span>Collection</span><strong>${escapeHtml(selected.origin)}</strong></div>
              <div><span>Delivery</span><strong>${escapeHtml(selected.destination)}</strong></div>
              <div><span>Courier Reward</span><strong class="profit-good">+CR ${formatNumber(selected.reward)}</strong></div>
              <div><span>Route</span><strong>${selected.jumps} ${selected.jumps === 1 ? "jump" : "jumps"} · ${escapeHtml(selected.risk)}</strong></div>
            </div>
            <p class="trade-v2-contract-guidance">${state === "locked" ? "Complete the active contract before accepting another." : state === "complete" ? "This contract has been completed for the current UTC day." : state === "active" ? escapeHtml(selected.packageName) + " is secured in your hold. Deliver it to " + escapeHtml(selected.destination) + "." : getCurrentMarketPlanet() === selected.origin ? "Accepting immediately loads the sealed package into your cargo hold." : "Travel to " + escapeHtml(selected.origin) + " to accept and collect this package."}</p>
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
      <p class="trade-v2-transaction-note">${buying ? "No route is accepted yet. Prices may change while you travel." : "Purchased and recovered cargo sell at the same current local price. Upgrade materials are excluded."}</p>
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

/* Final quick-action terminal. The dedicated V2 renderers above remain as a safe
   compatibility fallback, while this single workspace owns the player flow. */
function renderLiveMarketPriceTable({ interactive = true } = {}) {
  const currentPlanet = getCurrentMarketPlanet();
  return `
    <div class="trade-v2-table-wrap" data-market-scroll-region tabindex="0" aria-label="Live commodity prices">
      <table class="trade-v2-market-table">
        <thead><tr><th scope="col">Commodity</th>${MAP_ONE_MARKET_PLANETS.map((planet) => `<th scope="col" class="${planet === currentPlanet ? "is-current" : ""}">${planet === currentPlanet ? `<span class="trade-v2-current-station-marker" aria-hidden="true">&#8982;</span>${escapeHtml(planet)} <small>Current Station</small>` : escapeHtml(planet)}</th>`).join("")}</tr></thead>
        <tbody>
          ${MAP_ONE_TRADE_RESOURCES.map((good) => {
            const info = commodityInfo[good] || {};
            const selected = interactive && good === selectedMarketResource;
            return `<tr
              class="${selected ? "is-selected" : ""}"
              ${good === "Iron" ? 'data-tutorial-target="marketResourceIron"' : ""}
              ${interactive ? `tabindex="0" role="button" aria-selected="${selected}" aria-label="Select ${escapeHtml(good)}" onclick="setMarketResource('${escapeJsString(good)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();setMarketResource('${escapeJsString(good)}');}"` : ""}>
              <th scope="row"><span class="trade-v2-commodity"><img src="${escapeHtml(info.icon || getCommodityImage(good))}" alt=""><strong>${escapeHtml(good)}</strong></span></th>
              ${MAP_ONE_MARKET_PLANETS.map((planet) => renderLiveMarketPriceCell(good, planet, currentPlanet, interactive)).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getDailyContractActionMarkup(contract) {
  const state = getTradeContractState(contract);
  if (state === "complete") return `<button type="button" class="trade-v2-contract-action is-complete" disabled aria-disabled="true">Complete</button>`;
  if (state === "locked") return `<button type="button" class="trade-v2-contract-action" disabled aria-disabled="true" title="Complete the active contract before accepting another.">Locked</button>`;
  if (state === "available") {
    const atOrigin = getCurrentMarketPlanet() === contract.origin;
    const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
    const canAccept = atOrigin && freeCargo >= contract.cargoSpace;
    const label = !atOrigin ? "Start at " + contract.origin : freeCargo < contract.cargoSpace ? "Need " + formatNumber(contract.cargoSpace) + " Space" : "Accept & Load";
    return `<button type="button" class="trade-v2-contract-action" data-contract-action="accept" onclick="acceptDailyTradeContract('${escapeJsString(contract.id)}')" ${canAccept ? "" : "disabled aria-disabled=\"true\""}>${escapeHtml(label)}</button>`;
  }
  const atDestination = getCurrentMarketPlanet() === contract.destination;
  return `<button type="button" class="trade-v2-contract-action is-active" data-contract-action="complete" onclick="completeDailyTradeContract('${escapeJsString(contract.id)}')" ${atDestination ? "" : "disabled aria-disabled=\"true\""}>${atDestination ? "Complete Delivery" : "Deliver to " + escapeHtml(contract.destination)}</button>`;
}

function renderDailyTradePreviewRow(contract, index) {
  const state = getTradeContractState(contract);
  const stateLabel = state === "available" ? contract.risk : state.toUpperCase();
  const stateClass = state === "available" ? `risk-${contract.riskTone}` : `trade-v2-contract-state trade-v2-contract-state--${state}`;
  return `
    <article class="trade-v2-contract-preview is-${state}" data-contract-id="${escapeHtml(contract.id)}">
      <span class="trade-v2-contract-index">${index + 1}</span>
      <img src="${escapeHtml(contract.packageImage)}" alt="">
      <div class="trade-v2-contract-copy"><strong>${escapeHtml(contract.name)}</strong><span>${escapeHtml(contract.origin)} <b>&rarr;</b> ${escapeHtml(contract.destination)}</span><small>${escapeHtml(contract.packageName)} &middot; ${formatNumber(contract.cargoSpace)} cargo</small></div>
      <em class="${stateClass}">${escapeHtml(stateLabel)}</em>
      <strong class="trade-v2-profit">+${formatNumber(contract.reward)} CR</strong>
      <div class="trade-v2-contract-inline-action">${getDailyContractActionMarkup(contract)}</div>
    </article>
  `;
}

function getQuickMarketWriteState(operation, good, planet, destination = selectedMarketTargetPlanet) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good) || !MAP_ONE_MARKET_PLANETS.includes(planet)) {
    return { enabled: false, reason: "Market unavailable here.", offer: null };
  }
  if (!isMultiplayerStagingActive() || isLocalTutorialTradeActive()) return { enabled: true, reason: "", offer: null };
  if (!isMultiplayerStagingTradeReady()) return { enabled: false, reason: "Market connection unavailable.", offer: null };
  const offer = operation === "buy"
    ? getLiveMarketRouteOffer(good, destination)
    : getOpenMarketStagingOffer(operation, good, planet);
  if (!offer) return { enabled: false, reason: "This resource is unavailable here.", offer: null };
  if (isMultiplayerStagingTradePending(operation, offer.offerId)) return { enabled: false, reason: "Trade processing.", offer };
  return { enabled: true, reason: "", offer };
}

function renderLiveMarketQuickActions() {
  const good = MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource) ? selectedMarketResource : MAP_ONE_TRADE_RESOURCES[0];
  selectedMarketResource = good;
  const planet = getCurrentMarketPlanet();
  const quote = getSelectedLiveMarketRouteQuote(good);
  const target = quote.destination;
  const info = commodityInfo[good] || {};
  const price = quote.buyPrice;
  const capacity = Math.max(1, Number(getShipStats().cargo || 1));
  const used = Math.max(0, Number(cargoUsed() || 0));
  const freeCargo = Math.max(0, capacity - used);
  const buyLimit = getMarketQuantityLimit("buy");
  selectedMarketQuantity = clampNumber(selectedMarketQuantity, buyLimit > 0 ? 1 : 0, Math.max(0, buyLimit));
  const quantity = selectedMarketQuantity;
  const sellable = getLiveMarketSellableQuantity(good);
  const buyWrite = getQuickMarketWriteState("buy", good, planet, target);
  const sellWrite = getQuickMarketWriteState("sell", good, planet);
  const unitMargin = quote.unitProfit;
  const buyReason = !target ? "Choose a sell target." : freeCargo <= 0 ? "Cargo hold full." : credits < price ? "Not enough credits." : buyLimit <= 0 ? "Purchase unavailable." : buyWrite.reason;
  const buyDisabled = quantity <= 0 || price <= 0 || !target || freeCargo <= 0 || credits < price || buyLimit <= 0 || !buyWrite.enabled;
  const sellDisabled = sellable <= 0 || price <= 0 || !sellWrite.enabled;
  const sellMode = freeCargo <= 0 && sellable > 0;
  const saleValue = price * sellable;
  const purchased = getPurchasedCargoQuantity(good);
  const recovered = getRecoveredCargoQuantity(good);
  const unitBasis = purchased > 0 ? Number(getCargoCostBasisForResource(good) || price) : 0;
  const projectedResult = Math.round((purchased * (price - unitBasis)) + (recovered * price));
  const projectedResultLabel = projectedResult === 0
    ? "Break even"
    : `Projected result: ${projectedResult > 0 ? "+" : "-"}CR ${formatNumber(Math.abs(projectedResult))}`;
  const estimatedProfit = unitMargin * quantity;
  const marginClass = unitMargin >= 0 ? "profit-good" : "profit-bad";
  const resultClass = projectedResult >= 0 ? "profit-good" : "profit-bad";
  const buyButtonLabel = freeCargo <= 0
    ? "Cargo Hold Full"
    : credits < price
      ? "Insufficient Credits"
      : buyWrite.reason
        ? "Market Unavailable"
        : "Purchase Cargo";
  return `
    <section class="trade-v2-quick-action ${sellMode ? "is-sell-mode" : ""}" aria-label="${escapeHtml(good)} trade ticket">
      <div class="trade-v2-ticket-head">
        <img src="${escapeHtml(info.icon || getCommodityImage(good))}" alt="">
        <div><span>Selected Cargo</span><strong>${escapeHtml(good)}</strong></div>
      </div>
      <div class="trade-v2-route-metrics">
        <div><span>Buy at ${escapeHtml(planet)}</span><strong>CR ${formatNumber(price)}</strong></div>
        <div><span>Sell at ${escapeHtml(target || "Target")}</span><strong>CR ${formatNumber(quote.sellPrice || 0)}</strong></div>
        <div><span>${sellMode ? "Sale Value" : "Total Cost"}</span><strong>CR ${formatNumber(sellMode ? saleValue : price * quantity)}</strong></div>
        <div><span>${sellMode ? "Projected Result" : "Estimated Profit"}</span><strong class="${sellMode ? resultClass : marginClass}">${sellMode ? (projectedResult >= 0 ? "+" : "-") : (estimatedProfit >= 0 ? "+" : "-")}CR ${formatNumber(Math.abs(sellMode ? projectedResult : estimatedProfit))}</strong></div>
      </div>
      ${sellMode ? `
      <div class="trade-v2-cargo-note">
        <span>Cargo hold full</span>
        <strong>${formatNumber(sellable)} ${escapeHtml(good)} ready to sell</strong>
      </div>` : `
      <div class="trade-v2-buy-control">
        <span>Quantity</span>
        <div class="trade-v2-stepper">
          <button type="button" aria-label="Decrease quantity" onclick="adjustMarketQuantity(-1)" ${quantity <= 1 ? "disabled" : ""}>&minus;</button>
          <input type="number" min="${buyLimit > 0 ? 1 : 0}" max="${buyLimit}" value="${quantity}" inputmode="numeric" aria-label="Buy quantity" onchange="syncMarketQuantity(this.value)">
          <button type="button" aria-label="Increase quantity" onclick="adjustMarketQuantity(1)" ${quantity >= buyLimit ? "disabled" : ""}>+</button>
          <button type="button" class="trade-v2-max" data-tutorial-target="marketMaxAmount" onclick="setMarketQuantityMax()" ${buyLimit <= 0 ? "disabled" : ""}>Max</button>
        </div>
      </div>`}
      <div class="trade-v2-quick-buttons">
        ${sellMode ? "" : `<button type="button" class="trade-v2-transaction-action" data-tutorial-target="buyCargo" onclick="buyMarketCargo()" ${buyDisabled ? "disabled aria-disabled=\"true\"" : ""}>${escapeHtml(buyButtonLabel)}</button>`}
        ${sellable > 0 ? `<button type="button" class="trade-v2-sell-action" data-tutorial-target="sellCargo" onclick="sellMarketCargo()" ${sellDisabled ? "disabled aria-disabled=\"true\"" : ""}>Sell ${formatNumber(sellable)} ${escapeHtml(good)}</button>` : ""}
      </div>
    </section>
  `;
}

function renderDailyContractsStrip() {
  const completed = getDailyTradeProgress();
  const active = getDailyTradeContract(activeDailyTradeContractId);
  const tutorialStepId = typeof getCurrentTutorialStep === "function"
    ? getCurrentTutorialStep()?.id
    : "";
  const tutorialOpenClass = typeof tutorialState !== "undefined" &&
    tutorialState?.active &&
    tutorialStepId === "review-daily-contracts"
    ? " tutorial-highlight-target"
    : "";
  const supportingText = active
    ? `Deliver ${escapeHtml(active.name)} to ${escapeHtml(active.destination)} &middot; ${formatNumber(active.cargoSpace)} cargo reserved`
    : "Optional routes refresh each UTC day";
  return `
    <section class="trade-v2-contract-strip ${active ? "has-active-contract" : ""}" aria-label="Daily contract progress">
      <span class="trade-v2-contract-strip-icon" aria-hidden="true">&#9776;</span>
      <strong>Daily Contracts</strong>
      <span class="trade-v2-contract-strip-progress">${completed} / 4 Complete</span>
      <span class="trade-v2-contract-strip-copy">${supportingText}</span>
      <button type="button" class="trade-v2-contract-strip-button${tutorialOpenClass}" aria-expanded="${tradeContractsExpanded}" onclick="toggleDailyTradeContracts()">${tradeContractsExpanded ? "Close Contracts" : "View Contracts"}</button>
    </section>
  `;
}

function renderDailyContractsDrawer() {
  if (!tradeContractsExpanded) return "";
  const completed = getDailyTradeProgress();
  const tutorialStepId = typeof getCurrentTutorialStep === "function"
    ? getCurrentTutorialStep()?.id
    : "";
  const tutorialCloseClass = typeof tutorialState !== "undefined" &&
    tutorialState?.active &&
    tutorialStepId === "close-daily-contracts"
    ? " tutorial-highlight-target"
    : "";
  return `
    <section class="trade-v2-contract-drawer" role="dialog" aria-label="Daily Contracts">
      <header>
        <div>
          <span>Optional Trade Routes</span>
          <h3>Daily Contracts</h3>
          <p>Accept at the listed origin; the sealed package loads automatically. One active delivery at a time.</p>
        </div>
        <div class="trade-v2-contract-drawer-meta">
          <strong>${completed} / 4 Complete</strong>
          <small>Reset ${formatBountyResetCountdown(getDailyResetSeconds())}</small>
        </div>
        <button type="button" class="trade-v2-contract-drawer-close${tutorialCloseClass}" aria-label="Close Daily Contracts" onclick="toggleDailyTradeContracts()">&times;</button>
      </header>
      <div class="trade-v2-contract-drawer-list">
        ${dailyTradeContracts.map(renderDailyTradePreviewRow).join("")}
      </div>
      <footer>
        <span>Safe routes offer lower returns. Contested routes pay more.</span>
        <strong class="trade-v2-status" role="status">${escapeHtml(tradeTerminalStatusMessage)}</strong>
      </footer>
    </section>
  `;
}

function renderTradeOverview() {
  return `
    <div class="trade-v2-view trade-v2-overview ${tradeContractsExpanded ? "contracts-expanded" : ""}" data-trade-view="market-first">
      ${getTradeSummaryMarkup()}
      <section class="trade-v2-primary-panel trade-v2-market-overview" aria-labelledby="liveMarketTitle">
        <header class="trade-v2-panel-heading">
          <span class="trade-v2-panel-icon" aria-hidden="true">&#8599;</span>
          <div><h3 id="liveMarketTitle">Live Market</h3><p>Select a commodity, choose a sell target, then purchase cargo.</p></div>
        </header>
        <div class="trade-v2-market-first-content">
          <section class="trade-v2-market-board">
            ${renderLiveMarketPriceTable({ interactive: true })}
          </section>
          ${renderLiveMarketQuickActions()}
        </div>
      </section>
      ${renderDailyContractsStrip()}
      <footer class="trade-v2-footer"><span><b aria-hidden="true">&#128161;</b> Prices update every 3 minutes for all pilots. Sell carried cargo at the current station.</span><strong class="trade-v2-status" role="status">${escapeHtml(tradeTerminalStatusMessage)}</strong></footer>
      ${renderDailyContractsDrawer()}
    </div>
  `;
}

function renderMarketplace() {
  setupMultiplayerStagingTradeTerminalSubscription();
  requestMultiplayerStagingTradeOffersIfNeeded();
  ensureDailyTradeContracts();
  if (typeof reconcileTradeCargoLedgers === "function") reconcileTradeCargoLedgers();
  if (!MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource)) selectedMarketResource = "Iron";
  ensureLiveMarketTargetPlanet(selectedMarketResource);
  activeTradeTerminalTab = "overview";
  const planet = getCurrentMarketPlanet();
  const title = document.getElementById("marketLocationTitle");
  const flavor = document.getElementById("marketFlavorText");
  const body = document.getElementById("marketGoods");
  if (title) title.textContent = planet.toUpperCase();
  if (flavor) {
    flavor.textContent = "";
    flavor.hidden = true;
  }
  if (!body) return;
  renderedMarketCycle = getMarketCycle();
  body.innerHTML = renderTradeOverview();
  updateTradeTimerDisplay();
}
