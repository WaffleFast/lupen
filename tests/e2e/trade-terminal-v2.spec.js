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
    if (typeof applyShipStats === "function") applyShipStats(true);
    showScreen("gameScreen");
    openMarketplace();
  });
  await expect(page.locator("#marketScreen")).toHaveClass(/active/);
}

async function expectInsideViewport(page, selector) {
  const geometry = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

test.describe("Trade Terminal V2", () => {
  test("overview matches the two-panel target and excludes removed trading modes", async ({ page }) => {
    await prepareTerminal(page);

    await expect(page.locator("#marketScreen")).toContainText(/Daily Contracts/i);
    await expect(page.locator("#marketScreen")).toContainText(/Live Market/i);
    await expect(page.locator("#marketScreen")).toContainText(/0 \/ 4 Complete/i);
    await expect(page.locator(".trade-v2-primary-grid > .trade-v2-primary-panel")).toHaveCount(2);
    await expect(page.locator(".trade-v2-market-table tbody tr")).toHaveCount(3);
    await expect(page.locator(".trade-v2-market-table")).toContainText("Iron");
    await expect(page.locator(".trade-v2-market-table")).toContainText("Copper");
    await expect(page.locator(".trade-v2-market-table")).toContainText("Cobalt");
    await expect(page.locator("#marketScreen")).not.toContainText(/Salvage|Black Market|Best Opportunity|Crystal Shards|Lupen Shards/i);

    const widths = await page.locator(".trade-v2-primary-grid > .trade-v2-primary-panel").evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().width));
    expect(widths[1]).toBeGreaterThan(widths[0]);
    await expectInsideViewport(page, "#marketScreen");
    await page.screenshot({ path: "artifacts/trade-terminal-v2-overview-1366x768.png" });

    await page.setViewportSize({ width: 1600, height: 900 });
    await page.evaluate(() => renderMarketplace());
    await expectInsideViewport(page, "#marketScreen");
    await page.screenshot({ path: "artifacts/trade-terminal-v2-overview-large.png" });
  });

  test("daily contracts lock, persist, settle once, and reset on a new UTC day", async ({ page }) => {
    await prepareTerminal(page);
    await page.getByRole("button", { name: /Open Contracts/i }).click();
    await expect(page.locator(".trade-v2-contract-card")).toHaveCount(4);
    await page.screenshot({ path: "artifacts/trade-terminal-v2-contracts-none-active.png" });

    await page.getByRole("button", { name: /Accept Contract/i }).click();
    await expect(page.locator(".trade-v2-contract-card.is-active")).toHaveCount(1);
    await expect(page.locator(".trade-v2-contract-card.is-locked")).toHaveCount(3);
    await page.screenshot({ path: "artifacts/trade-terminal-v2-contract-active.png" });

    await page.getByRole("button", { name: /Load Contract Cargo/i }).click();
    await page.evaluate(() => {
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      renderMarketplace();
    });
    await page.getByRole("button", { name: /Complete Delivery/i }).click();
    await expect(page.locator(".trade-v2-contract-card.is-complete")).toHaveCount(1);
    await page.screenshot({ path: "artifacts/trade-terminal-v2-contract-one-complete.png" });

    const settlement = await page.evaluate(() => {
      const first = dailyTradeContracts[0];
      const creditsAfterFirst = credits;
      const duplicateBlocked = completeDailyTradeContract(first.id, first.completionEventId) === false;
      const creditsAfterDuplicate = credits;

      for (const contract of dailyTradeContracts.filter((entry) => entry.status !== "complete")) {
        currentNode = contract.origin;
        lastPlanetNode = contract.origin;
        if (!acceptDailyTradeContract(contract.id)) throw new Error("Could not accept " + contract.id);
        if (!loadDailyTradeContractCargo(contract.id)) throw new Error("Could not load " + contract.id);
        currentNode = contract.destination;
        lastPlanetNode = contract.destination;
        if (!completeDailyTradeContract(contract.id)) throw new Error("Could not complete " + contract.id);
      }

      const completedBeforeReset = getDailyTradeProgress();
      const saved = buildSaveState();
      const persistedStatuses = saved.dailyTradeContracts.map((contract) => contract.status);
      const tomorrow = new Date(Date.now() + 86400000);
      ensureDailyTradeContracts(tomorrow);
      const resetStatuses = dailyTradeContracts.map((contract) => contract.status);
      return {
        creditsAfterFirst,
        creditsAfterDuplicate,
        duplicateBlocked,
        completedBeforeReset,
        persistedStatuses,
        resetStatuses
      };
    });
    expect(settlement.duplicateBlocked).toBe(true);
    expect(settlement.creditsAfterDuplicate).toBe(settlement.creditsAfterFirst);
    expect(settlement.completedBeforeReset).toBe(4);
    expect(settlement.persistedStatuses).toEqual(["complete", "complete", "complete", "complete"]);
    expect(settlement.resetStatuses).toEqual(["available", "available", "available", "available"]);

    await page.evaluate(() => {
      dailyTradeDate = getDailyTradeDateKey();
      dailyTradeContracts = DAILY_TRADE_CONTRACT_DEFINITIONS.map((definition) => ({
        ...createDailyTradeContract(definition),
        status: "complete",
        completionEventId: "test:" + definition.id
      }));
      activeDailyTradeContractId = null;
      renderMarketplace();
    });
    await expect(page.locator(".trade-v2-contract-card.is-complete")).toHaveCount(4);
    await page.screenshot({ path: "artifacts/trade-terminal-v2-contracts-four-complete.png" });
  });

  test("live market buys and sells purchased, recovered, and mixed cargo without a route objective", async ({ page }) => {
    await prepareTerminal(page);
    await page.getByRole("button", { name: /Open Market/i }).click();
    await expect(page.locator(".trade-v2-market-table .trade-v2-trend")).toHaveCount(9);
    await expect(page.locator(".trade-v2-market-table th.is-current")).toContainText("Asteron Prime");
    await page.screenshot({ path: "artifacts/trade-terminal-v2-live-market.png" });

    await page.evaluate(() => {
      setMarketResource("Iron");
      setMarketMode("buy");
      syncMarketQuantity(10);
    });
    await page.screenshot({ path: "artifacts/trade-terminal-v2-buy-flow.png" });
    await page.getByRole("button", { name: /Buy Cargo/i }).click();
    const purchased = await page.evaluate(() => ({
      held: cargo.Iron,
      purchased: cargoPurchased.Iron,
      recovered: cargoRecovered.Iron || 0,
      objective: activeTradeRoute
    }));
    expect(purchased).toEqual({ held: 10, purchased: 10, recovered: 0, objective: null });

    await page.evaluate(() => {
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      setMarketMode("sell");
      syncMarketQuantity(6);
    });
    await page.getByRole("button", { name: /Sell Cargo/i }).click();
    const partialSale = await page.evaluate(() => ({ held: cargo.Iron, purchased: cargoPurchased.Iron, recovered: cargoRecovered.Iron || 0 }));
    expect(partialSale).toEqual({ held: 4, purchased: 4, recovered: 0 });
    await page.screenshot({ path: "artifacts/trade-terminal-v2-sell-purchased.png" });

    const mixedSale = await page.evaluate(() => {
      cargo.Copper = 8;
      cargoPurchased.Copper = 5;
      cargoRecovered.Copper = 3;
      cargoCostBasis.Copper = 38;
      selectedMarketResource = "Copper";
      selectedMarketMode = "sell";
      selectedMarketQuantity = 7;
      renderMarketplace();
      sellMarketCargo();
      return {
        held: cargo.Copper,
        purchased: cargoPurchased.Copper || 0,
        recovered: cargoRecovered.Copper || 0
      };
    });
    expect(mixedSale).toEqual({ held: 1, purchased: 0, recovered: 1 });

    await page.evaluate(() => {
      cargo.Cobalt = 6;
      delete cargoPurchased.Cobalt;
      cargoRecovered.Cobalt = 6;
      selectedMarketResource = "Cobalt";
      selectedMarketMode = "sell";
      selectedMarketQuantity = 6;
      renderMarketplace();
    });
    await page.screenshot({ path: "artifacts/trade-terminal-v2-sell-recovered.png" });
    await page.getByRole("button", { name: /Sell Cargo/i }).click();
    await expect(page.locator("body")).toContainText(/Recovered Cargo Sold/i);

    const cycles = await page.evaluate(() => {
      const cycle = getMarketCycle();
      const current = MAP_ONE_TRADE_RESOURCES.flatMap((good) => MAP_ONE_MARKET_PLANETS.map((planet) => getLiveMarketPriceForCycle(good, planet, cycle)));
      const next = MAP_ONE_TRADE_RESOURCES.flatMap((good) => MAP_ONE_MARKET_PLANETS.map((planet) => getLiveMarketPriceForCycle(good, planet, cycle + 1)));
      return { current, next, seconds: getNextMarketRefreshSeconds() };
    });
    expect(cycles.current.some((price, index) => price !== cycles.next[index])).toBe(true);
    expect(cycles.seconds).toBeGreaterThanOrEqual(0);
    expect(cycles.seconds).toBeLessThanOrEqual(90);
  });

  test("contracts and market remain usable at the 1366x768 minimum", async ({ page }) => {
    await prepareTerminal(page);
    await page.getByRole("button", { name: /Open Contracts/i }).click();
    await expectInsideViewport(page, "#marketScreen");
    await expect(page.locator(".trade-v2-contract-list")).toBeVisible();

    await page.evaluate(() => openLiveMarket());
    await expectInsideViewport(page, "#marketScreen");
    await expect(page.locator(".trade-v2-transaction")).toBeVisible();
  });
});
