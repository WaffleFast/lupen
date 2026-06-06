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
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/Trade for CR[\s\S]*LF-2 Hauler[\s\S]*Cargo Pod[\s\S]*Pulse Laser[\s\S]*Shield Booster[\s\S]*Erebus Patrol[\s\S]*automatic XP[\s\S]*Bounty Board[\s\S]*shard remains preview-only/i);
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
              maxQuantity: 1000
            },
            {
              offerId: "staging-crystal-asteron-nyxara",
              resourceId: "crystal_shards",
              resourceName: "Crystal Shards",
              buyNode: "Asteron Prime",
              sellNode: "Nyxara",
              buyPrice: 95,
              sellPrice: 145,
              maxQuantity: 1000
            },
            {
              offerId: "staging-cobalt-nyxara-asteron",
              resourceId: "cobalt",
              resourceName: "Cobalt",
              buyNode: "Nyxara",
              sellNode: "Asteron Prime",
              buyPrice: 62,
              sellPrice: 90,
              maxQuantity: 1000
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

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        credits = 10000;
        cargo.Iron = 0;
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
        selectedMarketQuantity = 63;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText(/Iron[\s\S]*Asteron Prime > Virella/);
    await expect(page.locator("#marketScreen")).toContainText("63 units");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,134");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,890");
    await expect(page.locator("#marketScreen")).toContainText("+CR 756");

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        credits = 10000;
        cargo.Iron = 0;
        cargo.Cobalt = 0;
        selectedMarketResource = "Cobalt";
        selectedMarketTargetPlanet = "Asteron Prime";
        selectedMarketQuantity = 14;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText(/Cobalt[\s\S]*Nyxara > Asteron Prime/);
    await expect(page.locator("#marketScreen")).toContainText("14 units");
    await expect(page.locator("#marketScreen")).toContainText("CR 868");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,260");
    await expect(page.locator("#marketScreen")).toContainText("+CR 392");

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
              maxQuantity: 1000
            },
            {
              offerId: "staging-copper-virella-nyxara",
              resourceId: "copper",
              resourceName: "Copper",
              buyNode: "Virella",
              sellNode: "Nyxara",
              buyPrice: 32,
              sellPrice: 50,
              maxQuantity: 1000
            },
            {
              offerId: "staging-crystal-asteron-nyxara",
              resourceId: "crystal_shards",
              resourceName: "Crystal Shards",
              buyNode: "Asteron Prime",
              sellNode: "Nyxara",
              buyPrice: 95,
              sellPrice: 145,
              maxQuantity: 1000
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
    await expect(page.locator("#marketScreen")).toContainText(/Sell 6 of 6 carried/);
    await expect(page.locator("#marketScreen")).toContainText("Sell Revenue");
    await expect(page.locator("#marketScreen")).toContainText("CR 180");
    await expect(page.locator("#marketScreen")).toContainText("+CR 72");
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        cargo.Iron = 0;
        cargo["Crystal Shards"] = 64;
        cargoCostBasis["Crystal Shards"] = 95;
        selectedMarketResource = "Crystal Shards";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 200;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText("Server Sell");
    await expect(page.locator("#marketScreen")).toContainText(/Asteron Prime > Nyxara/);
    await expect(page.locator("#marketScreen")).toContainText(/Sell 64 of 64 carried/);
    await expect(page.locator("#marketScreen")).toContainText("Sell Revenue");
    await expect(page.locator("#marketScreen")).toContainText("CR 9,280");
    await expect(page.locator("#marketScreen")).toContainText("+CR 3,200");
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store shows server-backed dry-run wording", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openStore(page);

    await expect(page.locator("#storeScreen")).toContainText(/Staging Purchase|Server Preview|Server preview unavailable/);
    await expect(page.locator("#storeScreen")).toContainText(/LF-2 Hauler|Hauler/i);
    await expect(page.locator("#storeScreen")).toContainText(/Pulse Laser/i);
    await expect(page.locator("#storeScreen")).toContainText(/Shield Booster/i);
    await expect(page.locator("#storeScreen")).toContainText(/LF-2 Hauler selection preview|Apply Cargo Pod|Cargo Pod equip preview|server-backed validation/i);
    await expect(page.locator("#storeScreen")).toContainText(/server-backed validation|server preview only|Real Store purchase is blocked|No CR or inventory changed/i);
    await expect(page.locator("#storeScreen")).not.toContainText("Buy / CR");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging bounty board uses player-facing staging bounty copy", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openBountyBoard(page);

    await expect(page.locator("#bountyScreen")).toContainText("MP STAGING BOUNTIES");
    await expect(page.locator("#bountyScreen")).toContainText("Erebus Patrol Sweep");
    await expect(page.locator("#bountyScreen")).toContainText(/Server-tracked staging bounty|Waiting for Multiplayer Staging/);
    await expect(page.locator("#bountyScreen")).toContainText(/40 XP|No CR or loot items/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });
});
