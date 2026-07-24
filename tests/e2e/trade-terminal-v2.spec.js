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
  expect(geometry.strip.bottom).toBeLessThanOrEqual(geometry.market.top);
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
    await expect(page.locator("#marketScreen")).not.toContainText(/Open Contracts|Open Market|Best Opportunity|Titanium|Nickel|Crystal Shards|Lupen Shards/i);
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

  test("contract packages load at their origin, persist, deliver once, and reset", async ({ page }) => {
    await prepareTerminal(page);
    await page.getByRole("button", { name: "View Contracts" }).click();
    const firstRow = page.locator("[data-contract-id='safe-delivery']");
    const secondRow = page.locator("[data-contract-id='bulk-freight']");

    await firstRow.getByRole("button", { name: "Accept & Load" }).click();
    await expect(firstRow).toHaveClass(/is-active/);
    await expect(firstRow).toContainText(/Deliver to Virella/i);
    await expect(secondRow).toHaveClass(/is-locked/);
    await expect(secondRow.getByRole("button", { name: "Locked" })).toBeDisabled();

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
      ensureDailyTradeContracts(new Date(Date.now() + 86400000));
      return {
        duplicateBlocked,
        creditsAfterFirst,
        creditsAfterDuplicate,
        packageAfterFirst,
        completedBeforeReset,
        savedStatuses: saved.dailyTradeContracts.map((entry) => entry.status),
        savedPackage: saved.dailyTradeContractCargo,
        resetStatuses: dailyTradeContracts.map((entry) => entry.status)
      };
    });
    expect(completion.duplicateBlocked).toBe(true);
    expect(completion.creditsAfterDuplicate).toBe(completion.creditsAfterFirst);
    expect(completion.packageAfterFirst).toBeNull();
    expect(completion.completedBeforeReset).toBe(4);
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

  test("commodity selection, quantity, MAX, buy, sell-all, ledgers, and progression work inline", async ({ page }) => {
    await prepareTerminal(page);
    const ironRow = page.locator(".trade-v2-market-table tbody tr", { hasText: "Iron" });
    const copperRow = page.locator(".trade-v2-market-table tbody tr", { hasText: "Copper" });

    await expect(page.getByRole("button", { name: "Sell Iron" })).toBeDisabled();
    await copperRow.click();
    await expect(copperRow).toHaveAttribute("aria-selected", "true");
    await expect(ironRow).toHaveAttribute("aria-selected", "false");
    await expect(page.locator(".trade-v2-market-table tbody tr[aria-selected='true']")).toHaveCount(1);
    await expect(page.locator(".trade-v2-quick-action")).toContainText(/Copper/i);
    await page.screenshot({ path: "artifacts/trade-terminal-quick-copper-selected.png" });

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

    const beforeBuy = await page.evaluate(() => ({ credits, quantity: selectedMarketQuantity, price: getLiveMarketPrice("Copper", "Asteron Prime") }));
    await page.getByRole("button", { name: "Buy Copper" }).click();
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
    expect(afterBuy.objective).toBeNull();
    await expect(page.getByRole("button", { name: new RegExp(`Sell ${beforeBuy.quantity} Copper`, "i") })).toBeEnabled();
    await page.screenshot({ path: "artifacts/trade-terminal-quick-sell-enabled.png" });

    await page.evaluate(() => {
      currentNode = "Virella";
      lastPlanetNode = "Virella";
      renderMarketplace();
    });
    const beforeSale = await page.evaluate(() => ({ credits, cargoSold: playerProgress.totals.cargoSold || 0 }));
    await page.getByRole("button", { name: /Sell .* Copper/i }).click();
    const afterSale = await page.evaluate(() => ({
      credits,
      held: cargo.Copper || 0,
      purchased: cargoPurchased.Copper || 0,
      recovered: cargoRecovered.Copper || 0,
      cargoSold: playerProgress.totals.cargoSold || 0,
      tradeProfit: playerProgress.totals.tradeProfit || 0,
      tradesCompleted: playerProgress.totals.tradesCompleted || 0,
      saved: buildSaveState()
    }));
    expect(afterSale.credits).toBeGreaterThan(beforeSale.credits);
    expect(afterSale.held).toBe(0);
    expect(afterSale.purchased).toBe(0);
    expect(afterSale.recovered).toBe(0);
    expect(afterSale.cargoSold).toBe(beforeSale.cargoSold + beforeBuy.quantity);
    expect(afterSale.tradeProfit).toBeGreaterThan(0);
    expect(afterSale.tradesCompleted).toBe(1);
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
      let targetCycle = cycle + 1;
      while (targetCycle < cycle + 30 && getLiveMarketPriceForCycle("Copper", "Asteron Prime", targetCycle) === price) targetCycle += 1;
      const realNow = Date.now;
      Date.now = () => targetCycle * TRADE_MARKET_REFRESH_MS + 1;
      renderedMarketCycle = cycle;
      updateTradeTimerDisplay();
      const result = {
        price: getLiveMarketPrice("Copper", "Asteron Prime"),
        quantity: selectedMarketQuantity,
        selected: selectedMarketResource,
        selectedRows: document.querySelectorAll(".trade-v2-market-table tbody tr[aria-selected='true']").length,
        totalText: document.querySelector(".trade-v2-buy-control > small")?.textContent || ""
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
