const { test, expect } = require("@playwright/test");

function collectUnexpectedBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR|colyseus/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });
  return failures;
}

async function expectNoUnexpectedBrowserErrors(failures) {
  expect(failures).toEqual([]);
}

async function waitForGameGlobals(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

async function openTradeTerminal(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openMarketplace === "function") window.openMarketplace();
  });
  await expect(page.locator("#marketScreen")).toHaveClass(/active/);
  await expect(page.locator("#marketScreen")).toContainText("TRADE TERMINAL");
}

async function openStore(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openStore === "function") window.openStore();
  });
  await expect(page.locator("#storeScreen")).toHaveClass(/active/);
  await expect(page.locator("#storeScreen")).toContainText("STATION STORE");
}

async function openBountyBoard(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openBountyBoard === "function") window.openBountyBoard();
  });
  await expect(page.locator("#bountyScreen")).toHaveClass(/active/);
  await expect(page.locator("#bountyScreen")).toContainText(/BOUNTIES|CONTRACTS/);
}

test.describe("Lupen browser smoke", () => {
  test("normal load shows the start screen without multiplayer staging", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");

    await expect(page.locator("#startScreen")).toHaveClass(/active/);
    await expect(page.locator("#startScreen h1")).toContainText("LUPEN");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("normal trade terminal opens without performing buy or sell actions", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openTradeTerminal(page);

    await expect(page.locator("#creditsText")).toBeVisible();
    await expect(page.locator("#cargoText")).toBeVisible();
    await expect(page.locator("#marketScreen")).toContainText(/Buy Cargo|Sell Cargo|Sell Here/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging mode exposes staging UI without using real trade buttons", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText("Multiplayer Staging Loop", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/Trade for CR[\s\S]*LF-2 Hauler[\s\S]*Cargo Pod[\s\S]*Pulse Laser[\s\S]*Shield Booster[\s\S]*Erebus Patrol[\s\S]*Claim XP[\s\S]*Lupen Shard/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/No PvP[\s\S]*player damage[\s\S]*loot items/i);
    await expect(page.locator("#lupenMultiplayerStagingTradePanel")).toHaveCount(0);

    await openTradeTerminal(page);

    await expect(page.locator("#marketScreen")).toContainText(/Server Buy|Preview Unavailable/);
    await expect(page.locator("#marketScreen")).not.toContainText("Buy Cargo");
    await expect(page.locator("#marketScreen")).toContainText(/MP staging|server/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("debug staging diagnostics can be opened without a live server", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("MP Staging", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/offline|connecting|connected/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging trade builder shows server-backed routes when offers are available", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !!window.LupenMultiplayerClient?.getStatus, null, { timeout: 15000 });
    await openTradeTerminal(page);
    await page.evaluate(() => {
      const client = window.LupenMultiplayerClient;
      const originalGetStatus = client.getStatus.bind(client);
      client.getStatus = () => ({
        ...originalGetStatus(),
        enabled: true,
        isConnected: true,
        enabledReason: "staging_enabled",
        lastStagingTradeOffers: {
          ok: true,
          offers: [
            {
              offerId: "staging-iron-asteron-virella",
              resourceId: "iron",
              resourceName: "Iron",
              buyNode: "Asteron Prime",
              sellNode: "Virella",
              buyPrice: 18,
              sellPrice: 30,
              maxQuantity: 40
            },
            {
              offerId: "staging-crystal-asteron-nyxara",
              resourceId: "crystal_shards",
              resourceName: "Crystal Shards",
              buyNode: "Asteron Prime",
              sellNode: "Nyxara",
              buyPrice: 95,
              sellPrice: 145,
              maxQuantity: 10
            }
          ]
        }
      });
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#lupenMultiplayerStagingTradePanel")).toHaveCount(0);
    await expect(page.locator("#marketScreen")).toContainText("Server Buy");
    await expect(page.locator("#marketScreen")).not.toContainText("Preview Unavailable");
    await expect(page.locator("#marketScreen")).toContainText(/Crystal Shards[\s\S]*Asteron Prime > Nyxara|Iron[\s\S]*Asteron Prime > Virella/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging trade builder shows server sell for carried cargo at destination", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !!window.LupenMultiplayerClient?.getStatus, null, { timeout: 15000 });
    await openTradeTerminal(page);
    await page.evaluate(() => {
      const client = window.LupenMultiplayerClient;
      const originalGetStatus = client.getStatus.bind(client);
      client.getStatus = () => ({
        ...originalGetStatus(),
        enabled: true,
        isConnected: true,
        enabledReason: "staging_enabled",
        lastStagingTradeOffers: {
          ok: true,
          offers: [
            {
              offerId: "staging-iron-asteron-virella",
              resourceId: "iron",
              resourceName: "Iron",
              buyNode: "Asteron Prime",
              sellNode: "Virella",
              buyPrice: 18,
              sellPrice: 30,
              maxQuantity: 40
            },
            {
              offerId: "staging-copper-virella-nyxara",
              resourceId: "copper",
              resourceName: "Copper",
              buyNode: "Virella",
              sellNode: "Nyxara",
              buyPrice: 32,
              sellPrice: 50,
              maxQuantity: 30
            }
          ]
        }
      });
      window.eval(`
        currentNode = "Virella";
        lastPlanetNode = "Virella";
        cargo.Iron = 6;
        cargoCostBasis.Iron = 18;
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText("Server Sell");
    await expect(page.locator("#marketScreen")).toContainText(/Asteron Prime > Virella/);
    await expect(page.locator("#marketScreen")).toContainText(/Carrying 6 Iron/);
    await expect(page.locator("#marketScreen")).toContainText(/Revenue CR 180|Profit \+CR 72/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store shows server-preview dry-run wording", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openStore(page);

    await expect(page.locator("#storeScreen")).toContainText(/Staging Purchase|Server Preview|Server preview unavailable/);
    await expect(page.locator("#storeScreen")).toContainText(/LF-2 Hauler|Hauler/i);
    await expect(page.locator("#storeScreen")).toContainText(/Pulse Laser/i);
    await expect(page.locator("#storeScreen")).toContainText(/Shield Booster/i);
    await expect(page.locator("#storeScreen")).toContainText(/Apply Cargo Pod|Cargo Pod equip preview|server preview/i);
    await expect(page.locator("#storeScreen")).toContainText(/server preview only|Real Store purchase is blocked|No CR or inventory changed/i);
    await expect(page.locator("#storeScreen")).not.toContainText("Buy / CR");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging bounty board uses server-owned bounty copy", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openBountyBoard(page);

    await expect(page.locator("#bountyScreen")).toContainText("MP STAGING BOUNTIES");
    await expect(page.locator("#bountyScreen")).toContainText("Erebus Patrol Sweep");
    await expect(page.locator("#bountyScreen")).toContainText(/Server-owned staging bounty|Waiting for staging multiplayer server/);
    await expect(page.locator("#bountyScreen")).toContainText(/XP-only reward|No CR or loot/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });
});
