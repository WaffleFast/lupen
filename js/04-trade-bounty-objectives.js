/* Marketplace */

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-GB");
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


function getMarketCycle() {
  return Math.floor(Date.now() / 600000);
}

function getNextMarketRefreshSeconds() {
  return Math.max(0, 600 - Math.floor((Date.now() % 600000) / 1000));
}

function updateTradeTimerDisplay() {
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

function getMapOneMarketPrice(good, planet) {
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

function normalizeMarketBuilderState() {
  const currentPlanet = getCurrentMarketPlanet();
  if (activeTradeRoute?.marketTrade && MAP_ONE_TRADE_RESOURCES.includes(activeTradeRoute.good)) {
    selectedMarketResource = activeTradeRoute.good;
  }
  const activeMarketTrade = activeTradeRoute?.marketTrade && activeTradeRoute.good === selectedMarketResource
    ? activeTradeRoute
    : null;

  if (!MAP_ONE_TRADE_RESOURCES.includes(selectedMarketResource)) {
    selectedMarketResource = "Crystal Shards";
  }

  if (activeMarketTrade?.destination && MAP_ONE_MARKET_PLANETS.includes(activeMarketTrade.destination)) {
    selectedMarketTargetPlanet = activeMarketTrade.destination;
  } else if (!MAP_ONE_MARKET_PLANETS.includes(selectedMarketTargetPlanet) || selectedMarketTargetPlanet === currentPlanet) {
    selectedMarketTargetPlanet = MAP_ONE_MARKET_PLANETS.find(planet => planet !== currentPlanet) || "Nyxara";
  }

  const maxBuy = getMarketMaxBuyQuantity(selectedMarketResource, currentPlanet);
  selectedMarketQuantity = clampNumber(selectedMarketQuantity || 1, 1, Math.max(1, maxBuy || getShipStats().cargo || 1));
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

function setTradeTerminalTab(tabName) {
  activeTradeTerminalTab = "market";
  renderMarketplace();
}

function renderMarketplace() {
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

  const currentPlanet = getCurrentMarketPlanet();
  const orderedMarketPlanets = getOrderedMapOneMarketPlanets(currentPlanet);
  const resource = selectedMarketResource;
  const targetPlanet = selectedMarketTargetPlanet;
  const quantity = selectedMarketQuantity;
  const buyPrice = getMapOneMarketPrice(resource, currentPlanet);
  const estimatedSellPrice = getMapOneMarketPrice(resource, targetPlanet);
  const totalCost = buyPrice * quantity;
  const estimatedRevenue = estimatedSellPrice * quantity;
  const estimatedProfit = estimatedRevenue - totalCost;
  const profitMargin = totalCost > 0 ? Math.round((estimatedProfit / totalCost) * 100) : 0;
  const cargoSpaceUsed = quantity;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const held = cargo[resource] || 0;
  const atTargetWithCargo = held > 0 && currentPlanet === targetPlanet;
  const maxBuy = getMarketMaxBuyQuantity(resource, currentPlanet);
  const canBuy = quantity > 0 && buyPrice > 0 && credits >= totalCost && freeCargo >= cargoSpaceUsed;
  const info = commodityInfo[resource] || {};

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
                return `
                  <tr class="${good === resource ? "selected-market-row" : ""}" onclick="setMarketResource('${escapeJsString(good)}')">
                    <td>
                      <div class="market-resource-cell">
                        <span class="commodity-icon market-board-icon">
                          <img src="${rowInfo.icon || getCommodityImage(good)}" alt="${good}" class="commodity-icon-img">
                        </span>
                        <strong>${good}</strong>
                      </div>
                    </td>
                    ${orderedMarketPlanets.map(planet => `
                      <td class="${planet === currentPlanet ? "current-market-planet" : ""}">CR ${formatNumber(getMapOneMarketPrice(good, planet))}</td>
                    `).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <aside class="market-builder-panel ${getCommodityRarityClass(resource)}">
        <div class="trade-panel-kicker">Trade Builder</div>
        <div class="market-builder-selected">
          <span class="commodity-icon market-builder-icon">
            <img src="${info.icon || getCommodityImage(resource)}" alt="${resource}" class="commodity-icon-img">
          </span>
          <div>
            <h3>${resource}</h3>
            <p>${currentPlanet} &gt; ${targetPlanet}</p>
          </div>
        </div>

        <div class="market-builder-controls">
          <label>
            <span>Target Planet</span>
            <select class="market-target-select" onchange="setMarketTargetPlanet(this.value)">
              ${MAP_ONE_MARKET_PLANETS.filter(planet => planet !== currentPlanet || planet === targetPlanet).map(planet => `<option value="${planet}" ${planet === targetPlanet ? "selected" : ""}>${planet}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Buy Amount</span>
            <div class="market-amount-control">
              <strong>${formatNumber(quantity)} units</strong>
              <button type="button" onclick="setMarketQuantityMax()" ${maxBuy <= 0 ? "disabled" : ""}>MAX</button>
              <button class="trade-primary-action" onclick="buyMarketCargo()" ${canBuy ? "" : "disabled"}>Buy Cargo</button>
            </div>
          </label>
        </div>

        <div class="market-builder-summary">
          <div><span>Total Cost</span><strong>CR ${formatNumber(totalCost)}</strong></div>
          <div class="profit-summary-card"><span>Estimated Profit</span><strong class="${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))}</strong></div>
        </div>

        ${held > 0 ? `<div class="market-builder-actions has-sell">
          <button class="trade-primary-action market-sell-action" onclick="sellMarketCargo()">${atTargetWithCargo ? "Sell Cargo" : "Sell Here"}</button>
        </div>` : ""}
      </aside>
    </div>
  `;
}

function setMarketResource(good) {
  if (!MAP_ONE_TRADE_RESOURCES.includes(good)) return;
  selectedMarketResource = good;
  tutorialEvent("selectedMarketResource");
  renderMarketplace();
}

function setMarketTargetPlanet(planet) {
  if (!MAP_ONE_MARKET_PLANETS.includes(planet)) return;
  selectedMarketTargetPlanet = planet;
  tutorialEvent("selectedMarketTarget");
  renderMarketplace();
}

function syncMarketQuantity(value) {
  selectedMarketQuantity = clampNumber(value, 1, 999999);
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function adjustMarketQuantity(delta) {
  normalizeMarketBuilderState();
  const maxBuy = getMarketMaxBuyQuantity();
  selectedMarketQuantity = clampNumber((selectedMarketQuantity || 1) + delta, 1, Math.max(1, maxBuy));
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function setMarketQuantityMax() {
  selectedMarketQuantity = Math.max(1, getMarketMaxBuyQuantity());
  tutorialEvent("selectedBuyAmount");
  renderMarketplace();
}

function buyMarketCargo() {
  normalizeMarketBuilderState();

  const currentPlanet = getCurrentMarketPlanet();
  const good = selectedMarketResource;
  const quantity = selectedMarketQuantity;
  const price = getMapOneMarketPrice(good, currentPlanet);
  const totalCost = price * quantity;
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());

  if (quantity <= 0 || !price || credits < totalCost || freeCargo < quantity) {
    alert("Check quantity, credits and cargo space before buying.");
    return;
  }

  const previousHeld = cargo[good] || 0;
  const previousBasis = cargoCostBasis[good] || price;

  credits -= totalCost;
  cargo[good] += quantity;
  cargoCostBasis[good] = Math.round(((previousHeld * previousBasis) + totalCost) / Math.max(1, previousHeld + quantity));
  setActiveTradeObjective({
    id: `market-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good,
    origin: currentPlanet,
    destination: selectedMarketTargetPlanet,
    buyPrice: price,
    sellPrice: getMapOneMarketPrice(good, selectedMarketTargetPlanet),
    profitPerUnit: getMapOneMarketPrice(good, selectedMarketTargetPlanet) - price,
    maxUnits: quantity,
    purchasedUnits: quantity,
    realizedProfit: 0,
    marketTrade: true
  });

  tutorialEvent("boughtTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  renderObjectiveHud();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}

function sellMarketCargo() {
  normalizeMarketBuilderState();
  const good = selectedMarketResource;
  const held = cargo[good] || 0;
  if (held <= 0) {
    alert(`You have no ${good} in cargo.`);
    return;
  }

  const currentPlanet = getCurrentMarketPlanet();
  const price = getEffectiveSellPrice(good, currentPlanet);
  const unitCost = cargoCostBasis[good] || getEffectiveBuyPrice(good, currentPlanet) || price;
  const saleRevenue = price * held;
  const tradeProfit = held * (price - unitCost);

  cargo[good] = 0;
  credits += saleRevenue;
  delete cargoCostBasis[good];
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + held;

  const activeTrade = getActiveTradePricing(good);
  if (activeTrade && currentPlanet === activeTrade.destination) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTrade.realizedProfit || 0)) + Math.max(0, tradeProfit)
    });
  }

  showTradeResultBurst({ good, quantity: held, profit: tradeProfit, revenue: saleRevenue });
  showTradeMiniFloat({ profit: tradeProfit });
  completeActiveTradeIfReady(good);
  tutorialEvent("soldTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
}

function renderBuyCommodities(market, stock, goodsBox) {
  goodsBox.innerHTML = `<div class="trade-commodity-grid"></div>`;
  const grid = goodsBox.querySelector(".trade-commodity-grid");

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
          <button onclick="buyGood('${good}')">Buy</button>
        </div>
      </div>
    `;

    grid.appendChild(item);
    updateTradePreview(good);
  });
}

function renderSellCommodities(market, stock, goodsBox) {
  const heldGoods = mineralKeys.filter(good => (cargo[good] || 0) > 0);

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
          <button onclick="sellGood('${good}')">Sell</button>
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

let bountyResetCountdownTimer = null;
let bountyBoardTimer = null;

function formatBountyResetCountdown(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function updateBountyResetCountdown() {
  const countdown = document.getElementById("bountyResetCountdown");
  if (!countdown) return;

  const secondsUntilReset = getDailyResetSeconds();
  countdown.textContent = `RESETS IN ${formatBountyResetCountdown(secondsUntilReset)}`;
  countdown.title = "Daily contracts refresh at local midnight.";

  if (secondsUntilReset <= 1) {
    ensureDailyBounties();
  }
}

function startBountyResetTimer() {
  stopBountyResetTimer();
  updateBountyResetCountdown();
  bountyResetCountdownTimer = setInterval(() => {
    updateBountyResetCountdown();
    updateActiveBountyTimers();
  }, 1000);
}

function stopBountyResetTimer() {
  if (!bountyResetCountdownTimer) return;
  clearInterval(bountyResetCountdownTimer);
  bountyResetCountdownTimer = null;
  stopBountyBoardTimer();
}

function startBountyBoardTimer() {
  stopBountyBoardTimer();
  bountyBoardTimer = setInterval(updateActiveBountyTimers, 1000);
}

function stopBountyBoardTimer() {
  if (!bountyBoardTimer) return;
  clearInterval(bountyBoardTimer);
  bountyBoardTimer = null;
}

function cloneBountyReward(reward = {}) {
  const legacyShards = Number(reward.weaponParts || 0) + Number(reward.equipmentModules || 0);
  return {
    credits: Number(reward.credits || 0),
    xp: Number(reward.xp || 0),
    lupenCores: Number(reward.lupenCores || 0),
    lupenShards: Number(reward.lupenShards ?? legacyShards ?? 0)
  };
}

function getBountyRequiredKills(contract) {
  return Number(contract?.requiredKills || contract?.killsRequired || 1);
}

function formatBountyReward(reward = {}) {
  const safeReward = cloneBountyReward(reward);
  const parts = [];
  if (safeReward.lupenCores) parts.push(`${formatNumber(safeReward.lupenCores)}x Lupen Core`);
  if (safeReward.credits) parts.push(`CR ${formatNumber(safeReward.credits)}`);
  if (safeReward.xp) parts.push(`${formatNumber(safeReward.xp)} XP`);
  if (safeReward.lupenShards) parts.push(`${formatNumber(safeReward.lupenShards)} Lupen Shards`);
  return parts.length ? parts.join(" / ") : "No reward";
}

function getBountyIconSrc(iconName) {
  const iconMap = {
    "bounty-patrol-sweep": "assets/bounties/bounty-patrol-sweep.png",
    "bounty-rapid-response": "assets/bounties/bounty-rapid-response.png",
    "bounty-behemoth-cull": "assets/bounties/bounty-behemoth-cull.png"
  };
  if (!iconName) return "assets/bounties/raider-sweep.png";
  if (iconMap[iconName]) return iconMap[iconName];
  if (String(iconName).includes("/") || String(iconName).endsWith(".png")) return iconName;
  if (typeof getBotImageSrc === "function") return getBotImageSrc(iconName);
  return "assets/bounties/raider-sweep.png";
}

function doesBotCountForBounty(bot, bounty) {
  if (!bot || !bounty) return false;
  if (bounty.targetBotType === "any_erebus") {
    return bot.faction === "erebus" || String(bot.botType || "").startsWith("erebus_");
  }
  return !bounty.targetBotType || bot.botType === bounty.targetBotType;
}

function formatBountyTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(Number(totalSeconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getBountyRemainingSeconds(contract) {
  if (!contract?.timed) return null;
  if (contract.status === "active" && contract.expiresAt) {
    return Math.max(0, Math.ceil((Number(contract.expiresAt) - Date.now()) / 1000));
  }
  return Number(contract.timeLimitSeconds || 0);
}

function getBountyTimerLabel(contract) {
  if (!contract?.timed) return "";
  if (contract.status === "failed") return "FAILED";
  if (["readyToClaim", "completed", "claimed"].includes(contract.status)) return "COMPLETED";
  const timeText = formatBountyTime(getBountyRemainingSeconds(contract));
  return contract.status === "active" ? `TIME REMAINING ${timeText}` : `TIME LIMIT ${timeText}`;
}

function getBountyTimerParts(contract) {
  const text = getBountyTimerLabel(contract);
  if (!text) return null;
  const match = text.match(/^(TIME LIMIT|TIME REMAINING)\s+(.+)$/);
  return match ? { label: match[1], value: match[2] } : { label: "STATUS", value: text };
}

function expireBountyContract(contract, shouldSave = true) {
  if (!contract || contract.status !== "active") return false;
  contract.status = "failed";
  contract.progress = 0;
  contract.expiresAt = null;
  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    activeObjective.status = "failed";
    activeObjective = null;
  }
  if (activeBountyId === contract.id) activeBountyId = null;
  addActivityLog(`Bounty expired: ${contract.title || contract.name}.`);
  updateHudDock();
  updateBountyHubBadge();
  if (shouldSave) saveGame();
  return true;
}

function updateActiveBountyTimers() {
  let changed = false;
  dailyBountyContracts.forEach(contract => {
    if (contract.timed && contract.status === "active" && contract.expiresAt && Date.now() > Number(contract.expiresAt)) {
      changed = expireBountyContract(contract, false) || changed;
    }
  });
  if (changed) saveGame();
  if (document.getElementById("bountyScreen")?.classList.contains("active")) renderBountyBoard();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
}

function ensureDailyBounties() {
  const today = getTodayKey();
  const templateIds = DAILY_BOUNTY_CONTRACTS.map(contract => contract.id).join("|");
  const currentIds = Array.isArray(dailyBountyContracts) ? dailyBountyContracts.map(contract => contract.id).join("|") : "";
  if (dailyBountyDate !== today || !Array.isArray(dailyBountyContracts) || !dailyBountyContracts.length || currentIds !== templateIds) {
    dailyBountyDate = today;
    dailyBountyContracts = createDailyBountyContracts();
    selectedBountyContractId = dailyBountyContracts[0]?.id || null;
    activeBountyId = null;
    if (activeObjective?.type === "bounty") activeObjective = null;
  }

  dailyBountyContracts = dailyBountyContracts.map(contract => {
    const template = DAILY_BOUNTY_CONTRACTS.find(item => item.id === contract.id) || contract;
    const targetArea = contract.targetArea || template.targetArea || "anyHostile";
    const requiredKills = getBountyRequiredKills({ ...template, ...contract });
    const savedTargetBotType = contract.targetBotType || "";
    const legacyPrefix = "man" + "ta_";
    const legacyPattern = new RegExp("man" + "ta", "i");
    const hasLegacyBotData = savedTargetBotType.startsWith(legacyPrefix) || legacyPattern.test(`${contract.subtitle || ""} ${contract.description || ""} ${contract.targetBotLabel || ""} ${contract.icon || ""}`);
    const targetBotType = hasLegacyBotData ? template.targetBotType : (contract.targetBotType || template.targetBotType || null);
    return {
      ...template,
      ...contract,
      name: hasLegacyBotData ? template.name : (contract.name || contract.title || template.name || template.title),
      title: hasLegacyBotData ? template.title : (contract.title || contract.name || template.title || template.name),
      subtitle: hasLegacyBotData ? template.subtitle : (contract.subtitle || template.subtitle || ""),
      description: hasLegacyBotData ? template.description : (contract.description || template.description || ""),
      type: contract.type || template.type || "standard",
      chipLabel: contract.chipLabel || template.chipLabel || "STANDARD",
      area: contract.area || template.area || getBountyAreaLabel(targetArea),
      targetArea,
      targetLabel: contract.targetLabel || template.targetLabel || getBountyAreaLabel(targetArea),
      targetBotType,
      targetBotLabel: hasLegacyBotData ? template.targetBotLabel : (contract.targetBotLabel || template.targetBotLabel || "Hostile Bot"),
      targetNode: undefined,
      requiredKills,
      killsRequired: requiredKills,
      reward: cloneBountyReward(typeof contract.reward === "object" ? contract.reward : template.reward),
      lootChance: Number(contract.lootChance ?? template.lootChance ?? 0),
      materialReward: contract.materialReward || template.materialReward || null,
      progress: Math.max(0, Number(contract.progress || 0)),
      timed: Boolean(contract.timed ?? template.timed),
      timeLimitSeconds: contract.timeLimitSeconds ?? template.timeLimitSeconds ?? null,
      expiresAt: contract.expiresAt || null,
      bonus: contract.bonus ?? template.bonus ?? null,
      accent: contract.accent || template.accent || "blue",
      icon: hasLegacyBotData ? template.icon : (contract.icon || template.icon),
      fallbackIcon: hasLegacyBotData ? template.fallbackIcon : (contract.fallbackIcon || template.fallbackIcon || "assets/bots/erebus-attacker.png"),
      status: ["available", "active", "readyToClaim", "completed", "claimed", "failed"].includes(contract.status) ? contract.status : "available"
    };
  });

  const activeContract = dailyBountyContracts.find(contract => contract.status === "active");
  activeBountyId = activeContract?.id || null;
}

function getBountyContract(contractId) {
  ensureDailyBounties();
  return dailyBountyContracts.find(contract => contract.id === contractId);
}

function getBountyObjectiveIcon(objective) {
  const contract = objective?.contractId ? getBountyContract(objective.contractId) : null;
  return getBountyIconSrc(objective?.icon || contract?.icon || contract?.fallbackIcon);
}

function getBountyStatusLabel(contract) {
  if (contract.status === "failed") return "FAILED";
  if (contract.status === "readyToClaim") return "COMPLETE";
  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    return activeObjective.status === "readyToClaim" ? "COMPLETE" : "ACTIVE";
  }
  if (contract.status === "completed" || contract.status === "claimed") return "CLAIMED";
  return "AVAILABLE";
}

function renderBountyBoard() {
  ensureDailyBounties();
  updateBountyResetCountdown();

  const title = document.getElementById("bountyLocationTitle");
  const grid = document.getElementById("bountyContractGrid");

  if (title) title.textContent = `DAILY SECTOR BOUNTIES`;

  if (activeObjective?.type === "bounty" && activeObjective.status === "readyToClaim") {
    selectedBountyContractId = activeObjective.contractId;
  }

  if (!selectedBountyContractId || !getBountyContract(selectedBountyContractId)) {
    selectedBountyContractId = dailyBountyContracts.find(contract => contract.status === "readyToClaim")?.id || dailyBountyContracts.find(contract => !["completed", "claimed", "failed"].includes(contract.status))?.id || dailyBountyContracts[0]?.id || null;
  }

  if (grid) {
    grid.innerHTML = dailyBountyContracts.map(contract => {
      const isSelected = selectedBountyContractId === contract.id;
      const status = getBountyStatusLabel(contract);
      const complete = contract.status === "completed" || contract.status === "claimed";
      const ready = contract.status === "readyToClaim";
      const failed = contract.status === "failed";
      const active = contract.status === "active";
      const statusKey = complete ? "claimed" : ready ? "completed" : failed ? "failed" : active ? "active" : "available";
      const icon = getBountyIconSrc(contract.icon || contract.fallbackIcon);
      const timerParts = getBountyTimerParts(contract);
      return `
        <button class="bounty-card bounty-contract-card bounty-card--${escapeHtml(contract.type || "standard")} bounty-card--${statusKey} ${isSelected ? "selected bounty-card--selected" : ""} ${complete ? "completed" : ""} ${ready ? "ready-to-claim" : ""} ${failed ? "failed" : ""} ${active ? "active" : ""}" onclick="selectBountyContract('${escapeJsString(contract.id)}')">
          ${ready || complete ? `<span class="bounty-card__status-check" aria-hidden="true">✓</span>` : ""}
          <span class="bounty-card__icon-frame bounty-card-icon"><img src="${icon}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></span>
          <span class="bounty-card__body bounty-card-copy">
            <strong class="bounty-card__title">${contract.title || contract.name}</strong>
            <span class="bounty-card__subtitle">${contract.subtitle || contract.description}</span>
            <span class="bounty-card__chips">
              <span class="bounty-chip bounty-chip--${escapeHtml(contract.type || "standard")}">${contract.chipLabel || "STANDARD"}</span>
              <span class="bounty-chip bounty-chip--target">${formatNumber(getBountyRequiredKills(contract))} ${contract.targetBotLabel || "bots"}</span>
              <span class="bounty-chip bounty-card-threat">${contract.threat || "Standard"}</span>
              ${timerParts ? `<span class="bounty-chip bounty-timer-chip"><small>${timerParts.label}</small><strong>${timerParts.value}</strong></span>` : ""}
            </span>
          </span>
          <span class="bounty-reward-box bounty-card-reward bounty-reward">
            <span class="bounty-reward-box__label">REWARD</span>
            <strong class="bounty-reward-box__value">${formatBountyReward(contract.reward)}<img class="bounty-reward-box__icon" src="assets/items/lupen-core.png" alt=""></strong>
            <em class="bounty-card-status bounty-status-chip bounty-status-chip--${statusKey}">${status}</em>
          </span>
        </button>
      `;
    }).join("");
  }

  renderBountyDetail();
}

function selectBountyContract(contractId) {
  selectedBountyContractId = contractId;
  renderBountyBoard();
}

function renderBountyDetail() {
  const panel = document.getElementById("bountyDetailPanel");
  if (!panel) return;

  const contract = getBountyContract(selectedBountyContractId);
  if (!contract) {
    const shell = panel.closest(".selected-contract-panel");
    if (shell) {
      ["available", "active", "completed", "claimed", "failed"].forEach(state => shell.classList.remove(`selected-contract-panel--${state}`));
    }
    panel.innerHTML = `<div class="bounty-empty">No bounty selected.</div>`;
    return;
  }

  const active = activeObjective?.type === "bounty" && activeObjective.contractId === contract.id;
  const readyToClaim = contract.status === "readyToClaim" || (active && activeObjective.status === "readyToClaim");
  const complete = contract.status === "completed" || contract.status === "claimed";
  const failed = contract.status === "failed";
  const stateKey = complete ? "claimed" : readyToClaim ? "completed" : failed ? "failed" : active ? "active" : "available";
  const shell = panel.closest(".selected-contract-panel");
  if (shell) {
    ["available", "active", "completed", "claimed", "failed"].forEach(state => shell.classList.remove(`selected-contract-panel--${state}`));
    shell.classList.add(`selected-contract-panel--${stateKey}`);
  }
  const requiredKills = getBountyRequiredKills(contract);
  const progress = readyToClaim ? requiredKills : active ? activeObjective.kills : contract.progress;
  const progressPct = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, requiredKills)) * 100)));
  const buttonDisabled = active || complete || readyToClaim || failed || Boolean(getActiveObjective());
  const buttonText = complete ? "Claimed" : failed ? "Failed" : readyToClaim ? "Claim Reward" : active ? "Active Bounty" : getActiveObjective() ? "Objective Active" : "Accept Bounty";
  const stateText = failed ? "Failed" : readyToClaim ? "Contract complete" : complete ? "Reward claimed" : active ? "Active objective" : "Available";
  const timerParts = getBountyTimerParts(contract);
  const completionNote = readyToClaim
    ? `<div class="bounty-complete-note"><strong>Complete</strong><span>Return to the board and claim this payout.</span></div>`
    : complete
      ? `<div class="bounty-complete-note claimed"><strong>Claimed</strong><span>This contract has been paid out.</span></div>`
      : failed
        ? `<div class="bounty-complete-note failed"><strong>Expired</strong><span>This contract failed before completion.</span></div>`
      : "";
  const icon = getBountyIconSrc(contract.icon || contract.fallbackIcon);
  const infoRows = [
    ["AREA", contract.area || contract.targetLabel],
    ["TARGET", contract.targetBotLabel],
    ["THREAT", contract.threat || "Standard"],
    ["OBJECTIVE", `Destroy ${formatNumber(requiredKills)} bots`],
    ["REWARD", `<span class="selected-bounty-reward selected-bounty-reward--${stateKey}"><span>${formatBountyReward(contract.reward)}</span><img src="assets/items/lupen-core.png" alt=""></span>`]
  ];
  if (contract.bonus) infoRows.push(["BONUS", contract.bonus]);

  panel.innerHTML = `
    <div class="selected-contract-top bounty-detail-hero selected-bounty-header selected-contract-top--${stateKey} ${readyToClaim ? "reward-ready" : ""} ${complete ? "completed" : ""} ${failed ? "failed" : ""}">
      <div class="selected-contract-icon bounty-detail-icon"><img src="${icon}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></div>
      <div class="selected-contract-copy">
        <span class="bounty-chip bounty-chip--${escapeHtml(contract.type || "standard")}">${contract.chipLabel || stateText}</span>
        ${readyToClaim || complete ? `<span class="selected-contract-check" aria-hidden="true">✓</span>` : ""}
        <strong>${contract.title || contract.name}</strong>
        <span>${readyToClaim ? "Contract complete. Claim your reward while docked." : complete ? "Reward claimed. This bounty is closed." : failed ? "This timed contract has expired." : contract.description}</span>
      </div>
    </div>

    ${completionNote}

    <div class="selected-contract-progress bounty-detail-progress-block selected-bounty-progress">
      <div class="bounty-progress-heading"><span>Progress</span><strong>${formatNumber(progress)} / ${formatNumber(requiredKills)}</strong></div>
      <div class="bounty-progress-bar"><span style="width:${progressPct}%"></span></div>
    </div>

    ${timerParts ? `<div class="selected-contract-timer selected-bounty-timer"><span>${timerParts.label}</span><strong>${timerParts.value}</strong></div>` : ""}

    <div class="selected-contract-rows bounty-detail-grid">
      ${infoRows.map(([label, value]) => `<div class="selected-contract-row bounty-detail-stat selected-bounty-info-row"><span>${label}</span><strong>${value || "None"}</strong></div>`).join("")}
    </div>

    <div class="selected-contract-actions bounty-detail-actions">
      ${readyToClaim ? `<button class="selected-contract-action bounty-claim-btn" onclick="claimBountyReward('${escapeJsString(contract.id)}')">Claim Reward</button>` : `<button class="selected-contract-action bounty-accept-btn accept-bounty-button" ${buttonDisabled ? "disabled" : ""} onclick="acceptBountyContract('${escapeJsString(contract.id)}')">${buttonText}</button>`}
      ${active && !readyToClaim ? `<button class="bounty-cancel-btn" onclick="cancelActiveBountyContract('${escapeJsString(contract.id)}')">Cancel Bounty</button>` : ""}
    </div>
    ${active && !readyToClaim ? `<p class="bounty-detail-note compact">Docked only / cancelling clears progress.</p>` : ""}
    ${getActiveObjective() && !active && !readyToClaim ? `<p class="bounty-detail-note">Finish your current active objective before accepting another.</p>` : ""}
  `;
}

function createBountyObjective(contract) {
  const requiredKills = getBountyRequiredKills(contract);
  return {
    id: `bounty-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type: "bounty",
    contractId: contract.id,
    title: contract.title || contract.name,
    targetArea: contract.targetArea || "anyHostile",
    targetLabel: contract.targetLabel || getBountyAreaLabel(contract.targetArea),
    targetBotType: contract.targetBotType || null,
    targetBotLabel: contract.targetBotLabel || "Hostile Bot",
    killsRequired: requiredKills,
    kills: contract.progress || 0,
    reward: contract.reward,
    timed: Boolean(contract.timed),
    timeLimitSeconds: contract.timeLimitSeconds || null,
    expiresAt: contract.expiresAt || null,
    lootChance: contract.lootChance,
    materialReward: contract.materialReward || null,
    icon: getBountyIconSrc(contract.icon || contract.fallbackIcon),
    createdAt: Date.now(),
    status: "active"
  };
}

function generateBountyMaterialRewards(contract) {
  const rule = contract?.materialReward;
  if (!rule || Math.random() >= Number(rule.chance || 0)) return [];
  const rawMaterialKey = rule.altMaterialKey && Math.random() < 0.5 ? rule.altMaterialKey : rule.materialKey;
  const materialKey = ["weaponParts", "equipmentModules"].includes(rawMaterialKey) ? "lupenShards" : rawMaterialKey;
  const definition = upgradeMaterialDefinitions?.[materialKey];
  if (!definition) return [];

  const min = Math.max(1, Math.floor(Number(rule.min || 1)));
  const max = Math.max(min, Math.floor(Number(rule.max || min)));
  const quantity = min + Math.floor(Math.random() * (max - min + 1));
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  upgradeMaterials[materialKey] = Math.max(0, Number(upgradeMaterials[materialKey] || 0)) + quantity;

  return [{
    rewardType: "material",
    key: materialKey,
    quantity,
    name: definition.name,
    icon: definition.icon,
    quality: "refined"
  }];
}

function acceptBountyContract(contractId) {
  const existingObjective = getActiveObjective();
  if (existingObjective) {
    alert("Complete your current active objective first.");
    return;
  }

  const contract = getBountyContract(contractId);
  if (!contract || ["completed", "claimed"].includes(contract.status)) return;
  if (contract.status === "failed") {
    alert("That contract has expired.");
    return;
  }

  contract.status = "active";
  contract.progress = 0;
  contract.expiresAt = contract.timed ? Date.now() + (Number(contract.timeLimitSeconds || 0) * 1000) : null;
  activeObjective = createBountyObjective(contract);
  activeBountyId = contract.id;
  selectedBountyContractId = contract.id;

  addActivityLog(`Bounty accepted: ${contract.title || contract.name}. Target: ${contract.targetBotLabel}.`);
  tutorialEvent("acceptedBounty");
  renderBountyBoard();
  updateHudDock();
  saveGame();
}

function cancelActiveBountyContract(contractId = null) {
  if (activeObjective?.type !== "bounty") return;

  const contract = getBountyContract(contractId || activeObjective.contractId);
  if (!contract || contract.id !== activeObjective.contractId) return;

  contract.status = "available";
  contract.progress = 0;
  contract.expiresAt = null;
  selectedBountyContractId = contract.id;
  activeBountyId = null;
  addActivityLog(`Bounty cancelled: ${contract.title || contract.name}.`);
  activeObjective = null;

  renderBountyBoard();
  updateHudDock();
  drawSectorMap();
  saveGame();
}

function completeActiveBountyObjective() {
  if (activeObjective?.type !== "bounty") return;

  const contract = getBountyContract(activeObjective.contractId);
  if (contract) {
    contract.status = "readyToClaim";
    contract.progress = activeObjective.killsRequired;
  }

  activeObjective.kills = activeObjective.killsRequired;
  activeObjective.status = "readyToClaim";
  selectedBountyContractId = activeObjective.contractId;
  jumpCharge = jumpMax;
  if (jumpTimer) {
    clearInterval(jumpTimer);
    jumpTimer = null;
  }

  addActivityLog(`Bounty complete: ${activeObjective.title}. Return to any planet to claim ${formatBountyReward(contract?.reward || activeObjective.reward)}.`);
  showBountyCompleteBurst(activeObjective);
  updateHudDock();
  updateBountyHubBadge();
  updateSpaceHUD();
  renderBountyBoard();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
  saveGame();
}

function claimBountyReward(contractId) {
  const contract = getBountyContract(contractId);
  if (!contract || contract.status !== "readyToClaim") return;

  let bonusDrops = [];
  if (Math.random() < Number(contract.lootChance || 0)) {
    bonusDrops = generateBotLootItems();
  }

  const reward = cloneBountyReward(contract.reward);
  const neededItemSlots = reward.lupenCores + bonusDrops.length;
  if (!canAddInventoryItems(neededItemSlots)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  const rewardSummary = formatBountyReward(contract.reward);
  const applied = applyBountyReward(contract);

  if (bonusDrops.length) {
    const inventoryResult = addInventoryItems(bonusDrops);
    bonusDrops = inventoryResult.added;
    if (bonusDrops.length) showItemFoundBurst(bonusDrops);
  }
  const materialDrops = generateBountyMaterialRewards(contract);
  bonusDrops = [...bonusDrops, ...materialDrops];

  const bonusText = bonusDrops.length ? summarizeInventoryItems(bonusDrops) : "No bonus loot recovered.";
  contract.status = "claimed";
  contract.progress = getBountyRequiredKills(contract);
  contract.expiresAt = null;

  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    activeObjective = null;
  }
  if (activeBountyId === contract.id) activeBountyId = null;

  selectedBountyContractId = dailyBountyContracts.find(item => item.status === "readyToClaim")?.id || dailyBountyContracts.find(item => item.status === "available")?.id || contract.id;
  awardBountyXpOnClaim(contract);
  addActivityLog(`Bounty reward claimed: ${contract.title || contract.name}. +${rewardSummary}. ${bonusText}`);
  tutorialEvent("claimedBountyReward");
  if (typeof playRewardClaimSound === "function") playRewardClaimSound();
  showBountyRewardOverlay(contract.title || contract.name, applied, bonusDrops);
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "continue-after-bounty-reward") {
    setTimeout(renderStarterTutorial, 80);
  }
  updateHudDock();
  updateBountyHubBadge();
  renderBountyBoard();
  saveGame();
}

function applyBountyReward(bounty) {
  const reward = cloneBountyReward(bounty?.reward);
  if (reward.lupenCores > 0) {
    const coreDrops = [];
    for (let index = 0; index < reward.lupenCores; index += 1) {
      coreDrops.push(createInventoryDrop("lupenCore"));
    }
    addInventoryItems(coreDrops);
  }

  credits += reward.credits;
  if (reward.xp > 0 && typeof addCombatXp === "function") {
    addCombatXp(reward.xp, "bounty");
  } else {
    playerProgress.combatXp = Number(playerProgress.combatXp || 0) + reward.xp;
  }
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  upgradeMaterials.lupenShards = Math.max(0, Number(upgradeMaterials.lupenShards || 0)) + reward.lupenShards;

  return reward;
}

function showBountyRewardOverlay(title, reward, bonusDrops = []) {
  let overlay = document.getElementById("bountyRewardOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "bountyRewardOverlay";
    overlay.className = "reward-overlay";
    document.body.appendChild(overlay);
  }

  const lootMarkup = bonusDrops.length
    ? bonusDrops.map(item => {
        if (item.rewardType === "material") {
          return `<div class="reward-loot-card quality-${item.quality || "refined"}"><img src="${item.icon || "assets/items/weapon-upgrade-parts.png"}" alt="${item.name || item.key}"><span>${escapeHtml(item.name || item.key)} x${formatNumber(item.quantity || 1)}</span></div>`;
        }
        const definition = itemDefinitions[item.key] || {};
        return `<div class="reward-loot-card quality-${item.quality}"><img src="${definition.icon || "assets/items/lupen-core.png"}" alt="${definition.name || item.key}"><span>${titleCaseQuality(item.quality)} ${definition.name || item.key}</span></div>`;
      }).join("")
    : `<div class="reward-no-loot">No bonus loot recovered.</div>`;

  overlay.innerHTML = `
    <div class="reward-modal">
      <div class="reward-kicker">Bounty Reward Claimed</div>
      <h2>${title}</h2>
      <div class="reward-credit-pulse">+ ${formatBountyReward(reward)}</div>
      <div class="reward-loot-list">${lootMarkup}</div>
      <button onclick="closeBountyRewardOverlay()">Continue</button>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeBountyRewardOverlay() {
  const overlay = document.getElementById("bountyRewardOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
  }
  tutorialEvent("closedBountyReward");
}

function trackBountyBotKill(bot) {
  if (activeObjective?.type !== "bounty") return;
  if (activeObjective.status === "readyToClaim") return;
  if (!bot) return;
  const botNode = bot.currentNodeId || bot.node;
  if (!isNodeInBountyArea(botNode, activeObjective.targetArea)) return;

  const contract = getBountyContract(activeObjective.contractId);
  if (!contract || contract.status !== "active") return;
  if (contract.timed && contract.expiresAt && Date.now() > Number(contract.expiresAt)) {
    expireBountyContract(contract);
    renderBountyBoard();
    return;
  }
  if (!doesBotCountForBounty(bot, contract)) {
    addActivityLog(`Bounty target mismatch: destroyed ${bot.displayName || bot.name || "hostile bot"}, but ${contract.targetBotLabel} required.`);
    updateHudDock();
    return;
  }

  activeObjective.kills = Math.min(activeObjective.killsRequired, (activeObjective.kills || 0) + 1);

  if (contract) {
    contract.progress = activeObjective.kills;
    contract.status = "active";
  }

  addActivityLog(`Bounty progress: ${activeObjective.title} ${activeObjective.kills}/${activeObjective.killsRequired}.`);

  if (activeObjective.kills >= activeObjective.killsRequired) {
    completeActiveBountyObjective();
  } else {
    updateHudDock();
    saveGame();
  }
}

function normalizeTradeRoute(route) {
  if (!route || !route.good || !sectorNodes[route.origin] || !sectorNodes[route.destination]) return null;

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
    title: `${normalized.good} Trade`
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
  const held = cargo[objective.good] || 0;

  if (currentNode === objective.destination) return objective.destination;
  if (held > 0 || Number(objective.purchasedUnits || 0) > 0) return objective.destination;
  return objective.origin;
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
  const held = cargo[objective.good] || 0;
  if (currentNode === objective.destination) return held > 0 ? "sell" : "arrived";
  if (currentNode === objective.origin) return held > 0 ? "launch" : "buy";
  return "travel";
}

function getTradeObjectiveActionText(objective = getActiveObjective()) {
  const stage = getTradeObjectiveStage(objective);
  if (stage === "buy") return "Buy stock";
  if (stage === "launch") return "Launch";
  if (stage === "sell") return "Sell cargo";
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
    panel.innerHTML = `<div class="objective-empty">No active objective.</div>`;
    return;
  }

  if (objective.type === "trade") {
    const held = cargo[objective.good] || 0;
    const margin = objective.sellPrice - objective.buyPrice;
    const info = commodityInfo[objective.good] || {};
    const targetNode = getTradeObjectiveTargetNode(objective);
    const path = getObjectiveRoutePath(objective);
    const nextHop = path.length > 1 ? path[1] : targetNode;
    const stage = getTradeObjectiveStage(objective);
    const potentialProfit = held > 0 ? held * margin : Number(objective.maxUnits || 0) * margin;
    const routeProgress = stage === "buy" ? "Buy cargo" : stage === "launch" ? "Launch and travel" : stage === "travel" ? `Next: ${nextHop || objective.destination}` : stage === "sell" ? "Sell cargo" : "Complete";
    const capacityText = `${formatNumber(held)} / ${formatNumber(objective.maxUnits || 0)}`;

    panel.innerHTML = `
      <div class="objective-list compact-objective-list">
        <div class="objective-hud-card objective-trade-card compact-objective-card ${getCommodityRarityClass(objective.good)}">
          <div class="objective-main-row compact-objective-main">
            <div class="commodity-icon objective-icon objective-icon-large">
              <img src="${info.icon || getCommodityImage(objective.good)}" alt="${objective.good}" class="commodity-icon-img">
            </div>

            <div class="objective-copy objective-copy-large">
              <div class="objective-title-line">
                <span class="objective-type-pill">Trade</span>
                <strong>${objective.good}</strong>
              </div>
              <span>${objective.origin} -> ${objective.destination}</span>
              <em>${routeProgress}</em>
            </div>

            <div class="objective-compact-actions">
              <button class="objective-map-btn" onclick="openSectorMap()">Map</button>
              <button class="objective-abandon-btn" onclick="abandonTradeRoute()">Abandon</button>
            </div>
          </div>

          <div class="objective-compact-stats">
            <div><span>Buy</span><strong>CR ${formatNumber(objective.buyPrice)}</strong></div>
            <div><span>Sell</span><strong>CR ${formatNumber(objective.sellPrice)}</strong></div>
            <div><span>Margin</span><strong class="${margin >= 0 ? "profit-good" : "profit-bad"}">${margin >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(margin))}/u</strong></div>
            <div><span>Held</span><strong>${capacityText}</strong></div>
            <div><span>Profit</span><strong class="${potentialProfit >= 0 ? "profit-good" : "profit-bad"}">${potentialProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(potentialProfit))}</strong></div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (objective.type === "bounty") {
    const icon = getBountyObjectiveIcon(objective);
    panel.innerHTML = `
      <div class="objective-hud-card bounty-objective-card">
        <div class="objective-hud-top">
          <span class="objective-type-pill bounty-pill">Bounty</span>
        </div>
        <div class="objective-main-row">
          <div class="objective-bounty-icon image"><img src="${icon}" alt=""></div>
          <div class="objective-copy">
            <strong>${objective.title}</strong>
            <span>${objective.targetLabel}</span>
          </div>
        </div>
        <div class="objective-mini-stats">
          <span>${getBountyObjectiveActionText(objective)}</span>
          <span>${formatNumber(objective.kills)} / ${formatNumber(objective.killsRequired)} bots</span>
          <span>CR ${formatNumber(objective.reward)}</span>
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
  return getObjectiveRoutePath(objective).includes(name);
}

function isLineOnActiveTradeRoute(a, b) {
  const path = getObjectiveRoutePath();
  for (let i = 0; i < path.length - 1; i += 1) {
    if ((path[i] === a && path[i + 1] === b) || (path[i] === b && path[i + 1] === a)) return true;
  }
  return false;
}

function getActiveTradeHudMarkup() {
  // Legacy shim retained for older UI references. Active objectives are now rendered by renderObjectiveHud().
  const objective = getActiveObjective();
  if (!objective || objective.type !== "trade") return "";
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
        <button id="${mode}Action-${id}" class="trade-primary-action" onclick="${actionFn}('${escapedGood}')" ${value <= 0 || max <= 0 ? "disabled" : ""}>${actionLabel}</button>
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

  const previousHeld = cargo[good] || 0;
  const previousBasis = cargoCostBasis[good] || price;

  credits -= price * maxBuy;
  cargo[good] += maxBuy;

  const activeTrade = getActiveTradePricing(good);
  if (activeTrade && activeTrade.origin === currentNode) {
    updateActiveTradeProgress({
      purchasedUnits: Number(activeTrade.purchasedUnits || 0) + maxBuy,
      maxUnits: Number(activeTrade.maxUnits || getShipStats().cargo || 0)
    });
  }

  cargoCostBasis[good] = Math.round(((previousHeld * previousBasis) + (maxBuy * price)) / Math.max(1, previousHeld + maxBuy));

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

  if (maxSell <= 0) {
    alert(`Select a quantity first, or check your ${good} stock.`);
    return;
  }

  const activeTrade = getActiveTradePricing(good);
  const unitCost = cargoCostBasis[good] || activeTrade?.buyPrice || price;
  const tradeProfit = maxSell * (price - unitCost);
  const saleProfit = activeTrade && currentNode === activeTrade.destination
    ? Math.max(0, tradeProfit)
    : Math.max(0, tradeProfit);
  const saleRevenue = price * maxSell;

  cargo[good] -= maxSell;
  credits += saleRevenue;
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + maxSell;

  showTradeResultBurst({ good, quantity: maxSell, profit: tradeProfit, revenue: saleRevenue });
  showTradeMiniFloat({ profit: tradeProfit });

  if (saleProfit > 0 && activeTrade) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTrade.realizedProfit || 0)) + saleProfit
    });
  }

  if ((cargo[good] || 0) <= 0) {
    delete cargoCostBasis[good];
    if (selectedLooseCargoSellGood === good) selectedLooseCargoSellGood = null;
  }

  completeActiveTradeIfReady(good);
  tutorialEvent("soldTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}


