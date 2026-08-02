const { test, expect } = require("@playwright/test");

async function prepareTerminal(page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.waitForFunction(() => typeof window.openMarketplace === "function");
  await page.evaluate(() => {
    localStorage.clear();
    tutorialState = { active: false, completed: true, stepIndex: 0 };
    ownedShips = ["falcon"];
    currentShipId = "falcon";
    currentNode = "Asteron Prime";
    lastPlanetNode = "Asteron Prime";
    credits = 50000;
    Object.keys(cargo).forEach((key) => { cargo[key] = 0; });
    cargoPurchased = {};
    cargoRecovered = {};
    cargoCostBasis = {};
    activeTradeRoute = null;
    activeObjective = null;
    dailyTradeDate = null;
    dailyTradeContracts = [];
    activeDailyTradeContractId = null;
    selectedDailyTradeContractId = null;
    dailyTradeContractCargo = null;
    selectedMarketResource = "Iron";
    selectedMarketMode = "buy";
    selectedMarketQuantity = 1;
    tradeTerminalStatusMessage = "";
    playerProgress = normalizePlayerProgress({
      combatXp: 0,
      totals: { tradeProfit: 0, totalTradingProfit: 0, tradesCompleted: 0, cargoSold: 0 }
    });
    if (typeof applyShipStats === "function") applyShipStats(true);
    showScreen("gameScreen");
    openMarketplace();
  });
  await expect(page.locator("#marketScreen")).toHaveClass(/active/);
}

async function getPageGeometry(page) {
  return page.evaluate(() => {
    const screen = document.getElementById("marketScreen").getBoundingClientRect();
    const market = document.querySelector(".trade-v2-market-overview").getBoundingClientRect();
    const strip = document.querySelector(".trade-v2-contract-strip").getBoundingClientRect();
    return {
      screen: { left: screen.left, top: screen.top, right: screen.right, bottom: screen.bottom },
      market: { top: market.top, bottom: market.bottom, left: market.left, right: market.right },
      strip: { top: strip.top, bottom: strip.bottom, left: strip.left, right: strip.right },
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollY
      }
    };
  });
}

function expectPageFits(geometry) {
  expect(geometry.screen.left).toBeGreaterThanOrEqual(0);
  expect(geometry.screen.top).toBeGreaterThanOrEqual(0);
  expect(geometry.screen.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
  expect(geometry.screen.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);
  expect(geometry.document.scrollWidth).toBeLessThanOrEqual(geometry.document.clientWidth + 1);
  expect(geometry.document.scrollHeight).toBeLessThanOrEqual(geometry.document.clientHeight + 1);
  expect(geometry.document.scrollY).toBe(0);
  expect(geometry.strip.left).toBeGreaterThanOrEqual(geometry.screen.left);
  expect(geometry.strip.right).toBeLessThanOrEqual(geometry.screen.right + 1);
  expect(geometry.strip.top).toBeGreaterThanOrEqual(geometry.market.bottom - 1);
  expect(geometry.strip.bottom).toBeLessThanOrEqual(geometry.screen.bottom + 1);
  expect(geometry.market.left).toBeGreaterThanOrEqual(geometry.screen.left);
  expect(geometry.market.right).toBeLessThanOrEqual(geometry.screen.right + 1);
  expect(geometry.market.bottom).toBeLessThanOrEqual(geometry.screen.bottom + 1);
}

test.describe("Trade Terminal final quick actions", () => {
  test("single workspace fits at 1366x768 and exposes only Map 1 commodities", async ({ page }) => {
    await prepareTerminal(page);

    await expect(page.locator(".trade-v2-summary-item:visible")).toHaveCount(3);
    await expect(page.locator(".trade-v2-market-overview")).toHaveCount(1);
    await expect(page.locator(".trade-v2-contract-strip")).toBeVisible();
    await expect(page.locator(".trade-v2-contract-preview")).toHaveCount(0);
    await expect(page.locator(".trade-v2-market-table tbody tr")).toHaveCount(3);
    await expect(page.locator(".trade-v2-market-table")).toContainText("Iron");
    await expect(page.locator(".trade-v2-market-table")).toContainText("Copper");
    await expect(page.locator(".trade-v2-market-table")).toContainText("Cobalt");
    await expect(page.locator(".trade-v2-quick-action")).toBeVisible();
    await expect(page.locator(".trade-v2-market-overview")).toContainText("Select a commodity, choose a sell target, then purchase cargo.");
    await expect(page.locator(".trade-v2-quick-action")).not.toContainText("Route Quote");
    await expect(page.locator(".trade-v2-route-metrics > div")).toHaveCount(4);
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Buy at Asteron Prime");
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Sell at Nyxara");
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Total Cost");
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Estimated Profit");
    await expect(page.locator(".trade-v2-ticket-head")).toContainText("Selected Cargo");
    await expect(page.locator(".trade-v2-ticket-head img")).toBeVisible();
    await expect(page.locator(".trade-v2-market-table thead th.is-current")).toContainText("Current Station");
    await expect(page.locator(".trade-v2-market-table thead th").nth(1)).toContainText("Asteron Prime");
    await expect(page.locator(".trade-v2-market-table td.is-current").first()).toContainText("Buy Here");
    await expect(page.locator(".trade-v2-market-table td.is-target").first()).toContainText("Selected Sell Target");
    await expect(page.locator(".trade-v2-market-table")).not.toContainText(/▲|▼/);
    await expect(page.getByRole("button", { name: "Purchase Cargo" })).toBeVisible();
    await expect(page.locator("#marketScreen")).not.toContainText(/Open Contracts|Open Market|Best Opportunity|Titanium|Nickel|Crystal Shards|Lupen Shards/i);
    const quickActionLayout = await page.locator(".trade-v2-quick-action").evaluate(panel => {
      const panelRect = panel.getBoundingClientRect();
      const buySummary = panel.querySelector(".trade-v2-buy-control > small")?.getBoundingClientRect();
      const buyButton = panel.querySelector(".trade-v2-transaction-action")?.getBoundingClientRect();
      const sellButton = panel.querySelector(".trade-v2-sell-action")?.getBoundingClientRect();
      const sellSummary = panel.querySelector(".trade-v2-quick-buttons > small")?.getBoundingClientRect();
      const elements = [buySummary, buyButton, sellButton, sellSummary].filter(Boolean);
      const lastButtonBottom = Math.max(buyButton?.bottom || 0, sellButton?.bottom || 0);
      return {
        allFit: elements.every(rect => (
          rect.left >= panelRect.left - 1 &&
          rect.right <= panelRect.right + 1 &&
          rect.top >= panelRect.top - 1 &&
          rect.bottom <= panelRect.bottom + 1
        )),
        buySummaryAboveButton: !buySummary || Boolean(buyButton && buySummary.bottom <= buyButton.top + 1),
        buttonsSeparated: !sellButton || Boolean(buyButton && (
          buyButton.bottom <= sellButton.top + 1 ||
          sellButton.bottom <= buyButton.top + 1 ||
          buyButton.right <= sellButton.left + 1 ||
          sellButton.right <= buyButton.left + 1
        )),
        sellSummaryBelowButton: !sellSummary || Boolean(buyButton && lastButtonBottom <= sellSummary.top + 1)
      };
    });
    expect(quickActionLayout).toEqual({
      allFit: true,
      buySummaryAboveButton: true,
      buttonsSeparated: true,
      sellSummaryBelowButton: true
    });
    expectPageFits(await getPageGeometry(page));
    await page.screenshot({ path: "artifacts/trade-terminal-quick-default-1366x768.png" });

    await page.getByRole("button", { name: "View Contracts" }).click();
    await expect(page.locator(".trade-v2-contract-drawer")).toBeVisible();
    await expect(page.locator(".trade-v2-contract-preview")).toHaveCount(4);
    await expect(page.locator(".trade-v2-contract-preview [data-contract-action='accept']")).toHaveCount(4);
    await page.screenshot({ path: "artifacts/trade-terminal-contract-drawer-1366x768.png" });
    await page.getByRole("button", { name: "Close Daily Contracts" }).click();
    await expect(page.locator(".trade-v2-contract-drawer")).toHaveCount(0);

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(() => renderMarketplace());
    expectPageFits(await getPageGeometry(page));
    await page.screenshot({ path: "artifacts/trade-terminal-quick-large-desktop.png" });
  });

  test("loss routes can be purchased and full cargo uses a clean sell action", async ({ page }) => {
    await prepareTerminal(page);

    const lossRoute = await page.evaluate(() => {
      const origin = getCurrentMarketPlanet();
      for (const good of MAP_ONE_TRADE_RESOURCES) {
        const buyPrice = getLiveMarketPrice(good, origin);
        for (const destination of MAP_ONE_MARKET_PLANETS.filter((planet) => planet !== origin)) {
          const sellPrice = getLiveMarketPrice(good, destination);
          if (sellPrice < buyPrice) {
            selectedMarketResource = good;
            selectedMarketTargetPlanet = destination;
            selectedMarketQuantity = 1;
            renderMarketplace();
            return { good, origin, destination, buyPrice, sellPrice };
          }
        }
      }
      return null;
    });

    expect(lossRoute).not.toBeNull();
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("-CR");
    await expect(page.getByRole("button", { name: "Purchase Cargo" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Choose Higher Sell Price/i })).toHaveCount(0);

    const purchased = await page.evaluate(() => {
      const beforeCredits = credits;
      const beforeCargo = Number(cargo[selectedMarketResource] || 0);
      buyMarketCargo();
      return {
        beforeCredits,
        afterCredits: credits,
        beforeCargo,
        afterCargo: Number(cargo[selectedMarketResource] || 0)
      };
    });
    expect(purchased.afterCredits).toBe(purchased.beforeCredits - lossRoute.buyPrice);
    expect(purchased.afterCargo).toBe(purchased.beforeCargo + 1);

    const fullCargoState = await page.evaluate((route) => {
      const capacity = getShipStats().cargo;
      Object.keys(cargo).forEach((key) => { cargo[key] = 0; });
      cargo[route.good] = capacity;
      cargoPurchased[route.good] = capacity;
      cargoRecovered[route.good] = 0;
      cargoCostBasis[route.good] = route.buyPrice;
      selectedMarketResource = route.good;
      selectedMarketTargetPlanet = route.destination;
      selectedMarketQuantity = 0;
      renderMarketplace();
      return { capacity };
    }, lossRoute);
    await expect(page.locator(".trade-v2-quick-action")).toHaveClass(/is-sell-mode/);
    await expect(page.locator(".trade-v2-cargo-note")).toContainText(`${fullCargoState.capacity} ${lossRoute.good}`);
    await expect(page.getByRole("button", { name: "Purchase Cargo" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Sell ${fullCargoState.capacity} ${lossRoute.good}` })).toBeVisible();
    await expect(page.locator(".trade-v2-quick-buttons")).not.toContainText("Sale value");
    await expect(page.locator(".trade-v2-quick-buttons")).not.toContainText("Projected result");

    const sellLayout = await page.locator(".trade-v2-quick-action").evaluate(panel => {
      const panelRect = panel.getBoundingClientRect();
      const children = Array.from(panel.children).map((child) => {
        const rect = child.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      });
      return {
        allFit: children.every((rect) => (
          rect.left >= panelRect.left - 1 &&
          rect.right <= panelRect.right + 1 &&
          rect.top >= panelRect.top - 1 &&
          rect.bottom <= panelRect.bottom + 1
        )),
        ordered: children.every((rect, index) => index === 0 || rect.top >= children[index - 1].bottom - 1)
      };
    });
    expect(sellLayout).toEqual({ allFit: true, ordered: true });
    await page.screenshot({ path: "artifacts/trade-terminal-sell-mode-1366x768.png" });
  });

  test("recovered resources can be sold without cramped helper text", async ({ page }) => {
    await prepareTerminal(page);

    const before = await page.evaluate(() => {
      cargo.Iron = 14;
      cargoRecovered.Iron = 14;
      cargoPurchased.Iron = 0;
      delete cargoCostBasis.Iron;
      selectedMarketResource = "Iron";
      selectedMarketTargetPlanet = "Nyxara";
      selectedMarketQuantity = 1;
      renderMarketplace();
      return {
        credits,
        sellPrice: getLiveMarketPrice("Iron", getCurrentMarketPlanet()),
        cargoSold: playerProgress.totals.cargoSold || 0
      };
    });

    await expect(page.getByRole("button", { name: "Sell 14 Iron" })).toBeEnabled();
    await expect(page.locator(".trade-v2-quick-buttons")).not.toContainText("Sale value");
    await expect(page.locator(".trade-v2-quick-buttons")).not.toContainText("Projected result");
    await page.getByRole("button", { name: "Sell 14 Iron" }).click();

    const after = await page.evaluate(() => ({
      credits,
      held: cargo.Iron || 0,
      recovered: cargoRecovered.Iron || 0,
      cargoSold: playerProgress.totals.cargoSold || 0,
      status: tradeTerminalStatusMessage
    }));
    expect(after.credits).toBe(before.credits + before.sellPrice * 14);
    expect(after.held).toBe(0);
    expect(after.recovered).toBe(0);
    expect(after.cargoSold).toBe(before.cargoSold + 14);
    expect(after.status).toContain("Sale complete");
    await page.screenshot({ path: "artifacts/trade-terminal-recovered-iron-sold.png" });
  });

  test("mixed recovered cargo does not block buying another resource", async ({ page }) => {
    await prepareTerminal(page);

    await page.evaluate(() => {
      cargo.Iron = 14;
      cargoRecovered.Iron = 14;
      selectedMarketResource = "Cobalt";
      selectedMarketTargetPlanet = "Nyxara";
      selectedMarketQuantity = 1;
      renderMarketplace();
    });

    await expect(page.locator(".trade-v2-quick-action")).toContainText("Cobalt");
    await expect(page.getByRole("button", { name: "Purchase Cargo" })).toBeEnabled();
    await expect(page.locator("#cargoText")).toContainText("14 /");
  });

  test("contract packages load at their origin, persist, deliver once, and reset", async ({ page }) => {
    await prepareTerminal(page);
    await page.getByRole("button", { name: "View Contracts" }).click();
    const firstRow = page.locator("[data-contract-id='safe-delivery']");
    const secondRow = page.locator("[data-contract-id='bulk-freight']");

    await firstRow.getByRole("button", { name: "Accept & Load" }).click();
    await expect(firstRow).toHaveClass(/is-active/);
    await expect(firstRow.locator(".trade-v2-contract-state--active")).toHaveText("ACTIVE");
    await expect(firstRow).toContainText(/Deliver to Virella/i);
    await expect(secondRow).toHaveClass(/is-locked/);
    await expect(secondRow.locator(".trade-v2-contract-state--locked")).toHaveText("LOCKED");
    await expect(secondRow.getByRole("button", { name: "Locked" })).toBeDisabled();
    await expect(page.locator(".trade-v2-contract-strip")).toContainText("Deliver Safe Delivery to Virella");
    await expect(page.locator(".trade-v2-contract-strip")).toContainText("20 cargo reserved");

    const accepted = await page.evaluate(() => ({
      credits,
      cargoIron: cargo.Iron || 0,
      purchasedIron: cargoPurchased.Iron || 0,
      cargoUsed: cargoUsed(),
      packageCargo: dailyTradeContractCargo,
      inventoryPackage: buildInventoryDrawerEntries().find((entry) => entry.source === "contract"),
      tacticalCargoMarkup: renderTacticalCargo(),
      activeId: activeDailyTradeContractId,
      activeObjective: activeTradeRoute && {
        contractId: activeTradeRoute.contractId,
        destination: activeTradeRoute.destination,
        packageName: activeTradeRoute.packageName,
        daily: activeTradeRoute.dailyTradeContract
      },
      cargoSpace: DAILY_TRADE_CONTRACT_DEFINITIONS[0].cargoSpace,
      saved: buildSaveState()
    }));
    expect(accepted.credits).toBe(50000);
    expect(accepted.cargoIron).toBe(0);
    expect(accepted.purchasedIron).toBe(0);
    expect(accepted.cargoUsed).toBe(accepted.cargoSpace);
    expect(accepted.packageCargo).toMatchObject({
      contractId: "safe-delivery",
      packageId: "cryo-seed-vault",
      name: "Cryogenic Seed Vault",
      destination: "Virella"
    });
    expect(accepted.inventoryPackage).toMatchObject({
      name: "Cryogenic Seed Vault",
      cargoSpace: 20,
      source: "contract",
      destination: "Virella"
    });
    expect(accepted.tacticalCargoMarkup).toContain("Cryogenic Seed Vault");
    expect(accepted.tacticalCargoMarkup).toContain("Sealed contract package");
    expect(accepted.activeId).toBe("safe-delivery");
    expect(accepted.activeObjective).toEqual({
      contractId: "safe-delivery",
      destination: "Virella",
      packageName: "Cryogenic Seed Vault",
      daily: true
    });
    expect(accepted.saved.activeDailyTradeContractId).toBe("safe-delivery");
    expect(accepted.saved.dailyTradeContractCargo).toMatchObject({ contractId: "safe-delivery" });
    await page.screenshot({ path: "artifacts/trade-terminal-quick-contract-active.png" });
    await page.screenshot({ path: "artifacts/trade-terminal-quick-contract-locked.png" });

    await page.evaluate(() => {
      const saved = buildSaveState();
      activeDailyTradeContractId = null;
      dailyTradeContracts = [];
      activeTradeRoute = null;
      activeObjective = null;
      dailyTradeContractCargo = null;
      applyLoadedGameState(saved);
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      openMarketplace();
    });
    await page.getByRole("button", { name: "View Contracts" }).click();
    await expect(page.locator("[data-contract-id='safe-delivery']")).toHaveClass(/is-active/);
    await page.locator("[data-contract-id='safe-delivery']").getByRole("button", { name: "Complete Delivery" }).click();
    await expect(page.locator("[data-contract-id='safe-delivery']")).toHaveClass(/is-complete/);
    await expect(page.locator(".trade-v2-summary")).toContainText("1 / 4 Complete");
    await expect(secondRow).not.toHaveClass(/is-locked/);

    const completion = await page.evaluate(() => {
      const completed = dailyTradeContracts[0];
      const creditsAfterFirst = credits;
      const packageAfterFirst = dailyTradeContractCargo;
      const duplicateBlocked = completeDailyTradeContract(completed.id, completed.completionEventId) === false;
      const creditsAfterDuplicate = credits;
      for (const contract of dailyTradeContracts.filter((entry) => entry.status !== "complete")) {
        currentNode = contract.origin;
        lastPlanetNode = contract.origin;
        if (!acceptDailyTradeContract(contract.id)) throw new Error("Could not accept " + contract.id);
        currentNode = contract.destination;
        lastPlanetNode = contract.destination;
        if (!completeDailyTradeContract(contract.id)) throw new Error("Could not complete " + contract.id);
      }
      const saved = buildSaveState();
      const completedBeforeReset = getDailyTradeProgress();
      const academyMission = { ...missionProgress.missions.academy_daily_contract };
      ensureDailyTradeContracts(new Date(Date.now() + 86400000));
      return {
        duplicateBlocked,
        creditsAfterFirst,
        creditsAfterDuplicate,
        packageAfterFirst,
        completedBeforeReset,
        academyMission,
        savedStatuses: saved.dailyTradeContracts.map((entry) => entry.status),
        savedPackage: saved.dailyTradeContractCargo,
        resetStatuses: dailyTradeContracts.map((entry) => entry.status)
      };
    });
    expect(completion.duplicateBlocked).toBe(true);
    expect(completion.creditsAfterDuplicate).toBe(completion.creditsAfterFirst);
    expect(completion.packageAfterFirst).toBeNull();
    expect(completion.completedBeforeReset).toBe(4);
    expect(completion.academyMission).toMatchObject({ state: "completed", progress: 1 });
    expect(completion.savedStatuses).toEqual(["complete", "complete", "complete", "complete"]);
    expect(completion.savedPackage).toBeNull();
    expect(completion.resetStatuses).toEqual(["available", "available", "available", "available"]);
  });

  test("contracts cannot start away from origin or without enough free cargo space", async ({ page }) => {
    await prepareTerminal(page);
    const result = await page.evaluate(() => {
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      const wrongOrigin = acceptDailyTradeContract("safe-delivery");
      currentNode = "Asteron Prime";
      lastPlanetNode = "Asteron Prime";
      cargo.Iron = getShipStats().cargo - 10;
      const insufficientSpace = acceptDailyTradeContract("safe-delivery");
      return {
        wrongOrigin,
        insufficientSpace,
        activeId: activeDailyTradeContractId,
        packageCargo: dailyTradeContractCargo,
        credits,
        iron: cargo.Iron
      };
    });
    expect(result).toEqual({
      wrongOrigin: false,
      insufficientSpace: false,
      activeId: null,
      packageCargo: null,
      credits: 50000,
      iron: 140
    });
  });

  test("legacy commodity contracts migrate to sealed package cargo", async ({ page }) => {
    await prepareTerminal(page);
    const migrated = await page.evaluate(() => {
      dailyTradeDate = getDailyTradeDateKey();
      dailyTradeContracts = DAILY_TRADE_CONTRACT_DEFINITIONS.map(createDailyTradeContract);
      dailyTradeContracts[0] = {
        id: "safe-delivery",
        status: "active",
        good: "Iron",
        quantity: 40,
        loadedQuantity: 40,
        acceptedAt: Date.now() - 1000,
        loadedAt: Date.now() - 500,
        dateKey: dailyTradeDate
      };
      activeDailyTradeContractId = "safe-delivery";
      dailyTradeContractCargo = null;
      activeTradeRoute = null;
      activeObjective = null;
      cargo.Iron = 40;
      cargoPurchased.Iron = 40;
      cargoCostBasis.Iron = 18;
      ensureDailyTradeContracts();
      return {
        cargoIron: cargo.Iron,
        purchasedIron: cargoPurchased.Iron || 0,
        cargoUsed: cargoUsed(),
        packageCargo: dailyTradeContractCargo,
        activeRoute: activeTradeRoute
      };
    });
    expect(migrated.cargoIron).toBe(0);
    expect(migrated.purchasedIron).toBe(0);
    expect(migrated.cargoUsed).toBe(20);
    expect(migrated.packageCargo).toMatchObject({
      contractId: "safe-delivery",
      packageId: "cryo-seed-vault"
    });
    expect(migrated.activeRoute).toMatchObject({
      dailyTradeContract: true,
      contractId: "safe-delivery",
      packageId: "cryo-seed-vault"
    });
  });

  test("commodity and target selection, affordability MAX, cargo purchase, sell-all, ledgers, and progression work inline", async ({ page }) => {
    await prepareTerminal(page);
    const ironRow = page.locator(".trade-v2-market-table tbody tr", { hasText: "Iron" });
    const copperRow = page.locator(".trade-v2-market-table tbody tr", { hasText: "Copper" });

    await expect(page.getByRole("button", { name: "Sell Iron" })).toHaveCount(0);
    await copperRow.click();
    await expect(copperRow).toHaveAttribute("aria-selected", "true");
    await expect(ironRow).toHaveAttribute("aria-selected", "false");
    await expect(page.locator(".trade-v2-market-table tbody tr[aria-selected='true']")).toHaveCount(1);
    await expect(page.locator(".trade-v2-quick-action")).toContainText(/Copper/i);
    await page.getByRole("button", { name: /Target Virella sell price for Copper/i }).click();
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Buy at Asteron Prime");
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Sell at Virella");
    await page.screenshot({ path: "artifacts/trade-terminal-quick-copper-selected.png" });

    await page.evaluate(() => {
      credits = 1000;
      selectedMarketQuantity = 1;
      renderMarketplace();
    });
    await page.getByRole("button", { name: "Max" }).click();
    const affordableMaxState = await page.evaluate(() => ({
      quantity: selectedMarketQuantity,
      expected: Math.min(
        Math.floor(credits / getLiveMarketPrice("Copper", getCurrentMarketPlanet())),
        getShipStats().cargo - cargoUsed(),
        MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY
      )
    }));
    expect(affordableMaxState.quantity).toBe(affordableMaxState.expected);

    await page.evaluate(() => {
      credits = 50000;
      selectedMarketQuantity = 1;
      renderMarketplace();
    });

    await page.getByRole("button", { name: "Max" }).click();
    const maxState = await page.evaluate(() => ({
      quantity: selectedMarketQuantity,
      expected: Math.min(
        Math.floor(credits / getLiveMarketPrice("Copper", getCurrentMarketPlanet())),
        getShipStats().cargo - cargoUsed(),
        MULTIPLAYER_STAGING_TRADE_WRITE_MAX_QUANTITY
      )
    }));
    expect(maxState.quantity).toBe(maxState.expected);
    await page.screenshot({ path: "artifacts/trade-terminal-quick-max-buy.png" });

    const beforeBuy = await page.evaluate(() => ({
      credits,
      quantity: selectedMarketQuantity,
      price: getLiveMarketPrice("Copper", "Asteron Prime"),
      target: selectedMarketTargetPlanet,
      sellPrice: getLiveMarketPrice("Copper", selectedMarketTargetPlanet)
    }));
    await page.getByRole("button", { name: "Purchase Cargo" }).click();
    const afterBuy = await page.evaluate(() => ({
      credits,
      held: cargo.Copper || 0,
      purchased: cargoPurchased.Copper || 0,
      recovered: cargoRecovered.Copper || 0,
      objective: activeTradeRoute
    }));
    expect(afterBuy.credits).toBe(beforeBuy.credits - beforeBuy.quantity * beforeBuy.price);
    expect(afterBuy.held).toBe(beforeBuy.quantity);
    expect(afterBuy.purchased).toBe(beforeBuy.quantity);
    expect(afterBuy.recovered).toBe(0);
    expect(afterBuy.objective).toMatchObject({
      marketTrade: true,
      good: "Copper",
      origin: "Asteron Prime",
      destination: beforeBuy.target,
      buyPrice: beforeBuy.price,
      sellPrice: beforeBuy.sellPrice,
      purchasedUnits: beforeBuy.quantity,
      acceptedAtCycle: expect.any(Number)
    });
    await expect(page.getByRole("button", { name: new RegExp(`Sell ${beforeBuy.quantity} Copper`, "i") })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Cargo Hold Full" })).toHaveCount(0);
    await expect(page.locator(".trade-v2-quick-action")).toHaveClass(/is-sell-mode/);
    await expect(page.locator(".trade-v2-cargo-note")).toContainText("Cargo hold full");
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Projected Result");
    await page.screenshot({ path: "artifacts/trade-terminal-quick-sell-enabled.png" });

    await page.evaluate(() => {
      currentNode = activeTradeRoute.destination;
      lastPlanetNode = activeTradeRoute.destination;
      renderMarketplace();
    });
    await expect(page.locator(".trade-v2-route-metrics")).toContainText("Projected Result");
    const beforeSale = await page.evaluate(() => ({ credits, cargoSold: playerProgress.totals.cargoSold || 0 }));
    await page.locator(".trade-v2-sell-action", { hasText: /Sell .* Copper/i }).click();
    const afterSale = await page.evaluate(() => ({
      credits,
      held: cargo.Copper || 0,
      purchased: cargoPurchased.Copper || 0,
      recovered: cargoRecovered.Copper || 0,
      cargoSold: playerProgress.totals.cargoSold || 0,
      tradeProfit: playerProgress.totals.tradeProfit || 0,
      tradesCompleted: playerProgress.totals.tradesCompleted || 0,
      objective: activeTradeRoute,
      saved: buildSaveState()
    }));
    expect(afterSale.credits).toBeGreaterThan(beforeSale.credits);
    expect(afterSale.held).toBe(0);
    expect(afterSale.purchased).toBe(0);
    expect(afterSale.recovered).toBe(0);
    expect(afterSale.cargoSold).toBe(beforeSale.cargoSold + beforeBuy.quantity);
    expect(afterSale.tradeProfit).toBeGreaterThan(0);
    expect(afterSale.tradesCompleted).toBe(1);
    expect(afterSale.objective).toBeNull();
    expect(afterSale.saved.cargoPurchased.Copper || 0).toBe(0);
    expect(afterSale.saved.cargoRecovered.Copper || 0).toBe(0);
    const creditsAfterFirstSale = afterSale.credits;
    await page.evaluate(() => sellMarketCargo());
    expect(await page.evaluate(() => credits)).toBe(creditsAfterFirstSale);

    const mixedSale = await page.evaluate(() => {
      cargo.Copper = 8;
      cargoPurchased.Copper = 5;
      cargoRecovered.Copper = 3;
      cargoCostBasis.Copper = 1;
      selectedMarketResource = "Copper";
      renderMarketplace();
      sellMarketCargo();
      return {
        held: cargo.Copper || 0,
        purchased: cargoPurchased.Copper || 0,
        recovered: cargoRecovered.Copper || 0,
        saved: buildSaveState()
      };
    });
    expect(mixedSale.held).toBe(0);
    expect(mixedSale.purchased).toBe(0);
    expect(mixedSale.recovered).toBe(0);
    expect(mixedSale.saved.cargoPurchased.Copper || 0).toBe(0);
    expect(mixedSale.saved.cargoRecovered.Copper || 0).toBe(0);
  });

  test("market refresh preserves selection, clamps quantity, and updates total cost", async ({ page }) => {
    await prepareTerminal(page);
    await page.locator(".trade-v2-market-table tbody tr", { hasText: "Copper" }).click();
    await page.evaluate(() => syncMarketQuantity(10));
    const before = await page.evaluate(() => ({
      cycle: getMarketCycle(),
      price: getLiveMarketPrice("Copper", "Asteron Prime"),
      quantity: selectedMarketQuantity,
      selected: selectedMarketResource
    }));

    const after = await page.evaluate(({ cycle, price }) => {
      let cycleOffset = 1;
      while (cycleOffset < 30 && getLiveMarketPriceForCycle("Copper", "Asteron Prime", cycle + cycleOffset) === price) cycleOffset += 1;
      const realNow = Date.now;
      Date.now = () => tradeMarketWindowStartedAt + cycleOffset * TRADE_MARKET_REFRESH_MS + 1;
      renderedMarketCycle = cycle;
      updateTradeTimerDisplay();
      const result = {
        price: getLiveMarketPrice("Copper", "Asteron Prime"),
        quantity: selectedMarketQuantity,
        selected: selectedMarketResource,
        selectedRows: document.querySelectorAll(".trade-v2-market-table tbody tr[aria-selected='true']").length,
        totalText: document.querySelector(".trade-v2-route-metrics")?.textContent || ""
      };
      Date.now = realNow;
      renderedMarketCycle = getMarketCycle();
      return result;
    }, before);
    expect(after.price).not.toBe(before.price);
    expect(after.selected).toBe("Copper");
    expect(after.selectedRows).toBe(1);
    expect(after.quantity).toBeGreaterThan(0);
    expect(after.totalText).toContain(`CR ${after.price * after.quantity}`);
    await expect(page.locator("#marketScreen")).not.toContainText(/Best Opportunity/i);
  });

  test("each origin has at least one profitable outgoing live-market route across cycles", async ({ page }) => {
    await prepareTerminal(page);
    const routeAudit = await page.evaluate(() => {
      const startCycle = getMarketCycle();
      return Array.from({ length: 30 }, (_, offset) => startCycle + offset).map((cycle) => ({
        cycle,
        origins: MAP_ONE_MARKET_PLANETS.map((origin) => {
          const profitableRoutes = [];
          for (const good of MAP_ONE_TRADE_RESOURCES) {
            const buyPrice = getLiveMarketPriceForCycle(good, origin, cycle);
            for (const destination of MAP_ONE_MARKET_PLANETS.filter((planet) => planet !== origin)) {
              const sellPrice = getLiveMarketPriceForCycle(good, destination, cycle);
              if (sellPrice > buyPrice) profitableRoutes.push({ good, origin, destination, buyPrice, sellPrice });
            }
          }
          return { origin, profitableRoutes };
        })
      }));
    });
    for (const auditCycle of routeAudit) {
      for (const row of auditCycle.origins) {
        expect(row.profitableRoutes.length, `${row.origin} should have an outgoing profitable route in cycle ${auditCycle.cycle}`).toBeGreaterThan(0);
      }
      expect(auditCycle.origins.find((row) => row.origin === "Virella")?.profitableRoutes.some((route) => route.destination === "Nyxara")).toBe(true);
      expect(auditCycle.origins.find((row) => row.origin === "Nyxara")?.profitableRoutes.some((route) => route.destination === "Virella")).toBe(true);
    }
  });

  test("opening the market starts a full quote window that survives the trip to sell", async ({ page }) => {
    await prepareTerminal(page);

    const windowState = await page.evaluate(() => {
      const realNow = Date.now;
      const anchor = Math.floor(realNow() / TRADE_MARKET_REFRESH_MS) * TRADE_MARKET_REFRESH_MS + 1000;
      Date.now = () => anchor;
      beginTradeMarketWindow({ force: true, now: anchor });
      renderedMarketCycle = getMarketCycle();
      renderMarketplace();

      const initial = {
        seconds: getNextMarketRefreshSeconds(),
        countdown: document.querySelector("[data-market-countdown]")?.textContent || "",
        cycle: getMarketCycle(),
        buyPrice: getLiveMarketPrice("Iron", "Asteron Prime"),
        sellPrice: getLiveMarketPrice("Iron", "Virella"),
        startedAt: tradeMarketWindowStartedAt
      };

      Date.now = () => anchor + 178000;
      updateTradeTimerDisplay();
      const beforeArrival = {
        seconds: getNextMarketRefreshSeconds(),
        cycle: getMarketCycle(),
        buyPrice: getLiveMarketPrice("Iron", "Asteron Prime"),
        sellPrice: getLiveMarketPrice("Iron", "Virella")
      };

      cargo.Iron = 1;
      cargoPurchased.Iron = 1;
      cargoCostBasis.Iron = initial.buyPrice;
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      openMarketplace();
      const atDestination = {
        seconds: getNextMarketRefreshSeconds(),
        cycle: getMarketCycle(),
        sellPrice: getLiveMarketPrice("Iron", "Virella"),
        startedAt: tradeMarketWindowStartedAt
      };

      Date.now = () => anchor + 180001;
      updateTradeTimerDisplay();
      activeTradeRoute = createTradeObjective({
        id: "expired-live-market-quote",
        type: "trade",
        title: "Iron Trade",
        marketTrade: true,
        good: "Iron",
        origin: "Asteron Prime",
        destination: "Virella",
        buyPrice: initial.buyPrice,
        sellPrice: initial.sellPrice,
        profitPerUnit: initial.sellPrice - initial.buyPrice,
        maxUnits: 1,
        purchasedUnits: 1,
        acceptedAtCycle: initial.cycle,
        status: "active"
      });
      activeObjective = activeTradeRoute;
      let objectivePanel = document.getElementById("activeObjectiveSummary");
      if (!objectivePanel) {
        objectivePanel = document.createElement("div");
        objectivePanel.id = "activeObjectiveSummary";
        document.body.appendChild(objectivePanel);
      }
      renderObjectiveHud();
      const afterExpiry = {
        seconds: getNextMarketRefreshSeconds(),
        cycle: getMarketCycle(),
        objectiveTarget: getTradeObjectiveTargetNode(activeTradeRoute),
        objectiveStage: getTradeObjectiveStage(activeTradeRoute),
        objectiveAction: getTradeObjectiveActionText(activeTradeRoute),
        objectiveHudText: objectivePanel.textContent || ""
      };

      Date.now = realNow;
      stopTradeTerminalTimer();
      return { initial, beforeArrival, atDestination, afterExpiry };
    });

    expect(windowState.initial).toMatchObject({
      seconds: 179,
      countdown: "02:59"
    });
    expect(windowState.beforeArrival).toMatchObject({
      seconds: 1,
      cycle: windowState.initial.cycle,
      buyPrice: windowState.initial.buyPrice,
      sellPrice: windowState.initial.sellPrice
    });
    expect(windowState.atDestination).toMatchObject({
      seconds: 1,
      cycle: windowState.initial.cycle,
      sellPrice: windowState.initial.sellPrice,
      startedAt: windowState.initial.startedAt
    });
    expect(windowState.afterExpiry.cycle).toBe(windowState.initial.cycle + 1);
    expect(windowState.afterExpiry.seconds).toBe(179);
    expect(windowState.afterExpiry.objectiveTarget).toBeNull();
    expect(windowState.afterExpiry.objectiveStage).toBe("sell-open");
    expect(windowState.afterExpiry.objectiveAction).toBe("Review live prices");
    expect(windowState.afterExpiry.objectiveHudText).toContain("Market refreshed");
    expect(windowState.afterExpiry.objectiveHudText).toContain("Review live prices");
    expect(windowState.afterExpiry.objectiveHudText).not.toContain("Asteron Prime -> Virella");
    expect(windowState.afterExpiry.objectiveHudText).not.toContain("Deliver before");
  });

  test("future commodity rows scroll internally while header and quick actions remain fixed", async ({ page }) => {
    await prepareTerminal(page);
    const layout = await page.evaluate(() => {
      const wrap = document.querySelector("[data-market-scroll-region]");
      const tbody = wrap.querySelector("tbody");
      const sourceRows = [...tbody.querySelectorAll("tr")];
      for (let index = 0; index < 9; index += 1) {
        const clone = sourceRows[index % sourceRows.length].cloneNode(true);
        clone.removeAttribute("data-tutorial-target");
        clone.setAttribute("data-test-future-row", String(index));
        tbody.appendChild(clone);
      }
      const header = wrap.querySelector("thead th").getBoundingClientRect();
      const quick = document.querySelector(".trade-v2-quick-action").getBoundingClientRect();
      const before = { headerTop: header.top, quickTop: quick.top, pageScroll: scrollY };
      wrap.scrollTop = 140;
      const headerAfter = wrap.querySelector("thead th").getBoundingClientRect();
      const quickAfter = document.querySelector(".trade-v2-quick-action").getBoundingClientRect();
      return {
        scrollHeight: wrap.scrollHeight,
        clientHeight: wrap.clientHeight,
        scrollTop: wrap.scrollTop,
        headerTopBefore: before.headerTop,
        headerTopAfter: headerAfter.top,
        quickTopBefore: before.quickTop,
        quickTopAfter: quickAfter.top,
        pageScrollBefore: before.pageScroll,
        pageScrollAfter: scrollY,
        pageFits: document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1
      };
    });
    expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);
    expect(layout.scrollTop).toBeGreaterThan(0);
    expect(Math.abs(layout.headerTopAfter - layout.headerTopBefore)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.quickTopAfter - layout.quickTopBefore)).toBeLessThanOrEqual(1);
    expect(layout.pageScrollBefore).toBe(0);
    expect(layout.pageScrollAfter).toBe(0);
    expect(layout.pageFits).toBe(true);
    await page.screenshot({ path: "artifacts/trade-terminal-quick-internal-scroll.png" });
  });
});
