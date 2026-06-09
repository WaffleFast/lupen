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

async function openHangar(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openHangar === "function") window.openHangar();
  });
  await expect(page.locator("#hangarScreen")).toHaveClass(/active/);
  await expect(page.locator("#hangarScreen")).toContainText("Loadout");
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
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/Trade for CR[\s\S]*Store upgrades[\s\S]*Launch[\s\S]*Engage bots[\s\S]*Claim bounty XP/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/No PvP[\s\S]*bots return fire locally/i);
    await expect(page.locator("#lupenMultiplayerStagingTradePanel")).toHaveCount(0);
    await expect(page.locator("#debugToolsPanel")).toHaveCount(0);

    await page.evaluate(() => {
      if (typeof window.openSectorMap === "function") window.openSectorMap();
    });
    await expect(page.locator("#sectorMap")).toHaveClass(/active/);
    await expect(page.locator("#sectorSvg .current-map-node")).toHaveCount(1);
    await expect(page.locator("#sectorSvg .svg-current-node-ship")).toHaveCount(0);
    await expect(page.locator("#sectorSvg .reachable-map-node")).not.toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-route.reachable-route")).not.toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-mp-ghost-layer")).toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-mp-bot-layer")).toHaveCount(0);

    await page.evaluate(() => {
      window.eval(`
        sectorScanState = {
          activeUntil: Date.now() + 5000,
          cooldownUntilByType: { ally: 0, bot: Date.now() + 10000, enemy: 0 },
          result: {
            createdAt: Date.now(),
            type: "bot",
            botSignals: [{ type: "bot", node: "Upper Apex", x: 50, y: 14, count: 2, names: ["Erebus Watcher", "Erebus Drone"], classes: ["Bot", "Bot"], threats: ["Medium", "Medium"], aggroStates: ["neutral", "neutral"] }],
            allySignals: [],
            enemySignals: []
          }
        };
        renderSectorMap();
        updateSectorScanPanel();
      `);
    });
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot")).toHaveCount(1);
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot .scan-count")).toContainText("2");
    await expect(page.locator("#sectorScanBotsBtn")).toContainText(/Bots 10s|Bots 9s/);
    await page.evaluate(() => {
      window.eval("sectorScanState.activeUntil = 0;");
      if (typeof window.renderSectorMap === "function") window.renderSectorMap();
    });
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot")).toHaveCount(0);

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
          offers: (() => {
            const resources = [
              { resourceId: "iron", resourceName: "Iron" },
              { resourceId: "copper", resourceName: "Copper" },
              { resourceId: "cobalt", resourceName: "Cobalt" },
              { resourceId: "crystal_shards", resourceName: "Crystal Shards" }
            ];
            const prices = {
              "Asteron Prime": { Iron: 18, Copper: 38, Cobalt: 90, "Crystal Shards": 95 },
              Virella: { Iron: 30, Copper: 32, Cobalt: 74, "Crystal Shards": 120 },
              Nyxara: { Iron: 24, Copper: 50, Cobalt: 62, "Crystal Shards": 145 }
            };
            const slugs = { "Asteron Prime": "asteron", Virella: "virella", Nyxara: "nyxara" };
            const resourceSlugs = { crystal_shards: "crystal" };
            return resources.flatMap((resource) => Object.keys(prices).flatMap((buyNode) => {
              return Object.keys(prices).filter((sellNode) => sellNode !== buyNode).map((sellNode) => ({
                offerId: `staging-${resourceSlugs[resource.resourceId] || resource.resourceId.replace(/_/g, "-")}-${slugs[buyNode]}-${slugs[sellNode]}`,
                resourceId: resource.resourceId,
                resourceName: resource.resourceName,
                buyNode,
                sellNode,
                buyPrice: prices[buyNode][resource.resourceName],
                sellPrice: prices[sellNode][resource.resourceName],
                maxQuantity: 1000
              }));
            }));
          })()
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
        selectedMarketTargetPlanet = "Virella";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Copper");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Copper[\s\S]*Asteron Prime > Virella/);

    await page.evaluate(() => {
      window.eval(`
        selectedMarketTargetPlanet = "Asteron Prime";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Iron");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Iron[\s\S]*Asteron Prime > Virella/);

    await page.evaluate(() => {
      if (typeof window.applyMultiplayerStagingTradeObjective === "function") {
        window.applyMultiplayerStagingTradeObjective({
          applied: true,
          operation: "buy",
          offerId: "staging-iron-asteron-virella",
          resourceName: "Iron",
          buyNode: "Asteron Prime",
          sellNode: "Virella",
          quantity: 6,
          buyPrice: 18,
          sellPrice: 30,
          cost: 108,
          projectedRevenue: 180,
          cargoDelta: 6
        });
      }
    });
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Deliver 6 Iron");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Asteron Prime -> Virella");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("+CR 72");
    await page.evaluate(() => {
      if (typeof window.clearActiveObjective === "function") window.clearActiveObjective("trade");
    });

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

    for (const planet of ["Asteron Prime", "Virella", "Nyxara"]) {
      await page.evaluate((nextPlanet) => {
        window.eval(`
          currentNode = ${JSON.stringify(nextPlanet)};
          lastPlanetNode = ${JSON.stringify(nextPlanet)};
          selectedMarketResource = "Iron";
          selectedMarketTargetPlanet = "";
          selectedMarketQuantity = 1;
        `);
        if (typeof window.renderMarketplace === "function") window.renderMarketplace();
      }, planet);
      for (const resource of ["Iron", "Copper", "Cobalt", "Crystal Shards"]) {
        await page.evaluate((nextResource) => {
          window.eval(`
            selectedMarketResource = ${JSON.stringify(nextResource)};
            selectedMarketTargetPlanet = "";
            selectedMarketQuantity = 1;
          `);
          if (typeof window.renderMarketplace === "function") window.renderMarketplace();
        }, resource);
        await expect(page.locator("#marketScreen")).toContainText(resource);
        await expect(page.locator("#marketScreen")).toContainText("Server Buy");
      }
    }

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
          offers: (() => {
            const resources = [
              { resourceId: "iron", resourceName: "Iron" },
              { resourceId: "copper", resourceName: "Copper" },
              { resourceId: "cobalt", resourceName: "Cobalt" },
              { resourceId: "crystal_shards", resourceName: "Crystal Shards" }
            ];
            const prices = {
              "Asteron Prime": { Iron: 18, Copper: 38, Cobalt: 90, "Crystal Shards": 95 },
              Virella: { Iron: 30, Copper: 32, Cobalt: 74, "Crystal Shards": 120 },
              Nyxara: { Iron: 24, Copper: 50, Cobalt: 62, "Crystal Shards": 145 }
            };
            const slugs = { "Asteron Prime": "asteron", Virella: "virella", Nyxara: "nyxara" };
            const resourceSlugs = { crystal_shards: "crystal" };
            return resources.flatMap((resource) => Object.keys(prices).flatMap((buyNode) => {
              return Object.keys(prices).filter((sellNode) => sellNode !== buyNode).map((sellNode) => ({
                offerId: `staging-${resourceSlugs[resource.resourceId] || resource.resourceId.replace(/_/g, "-")}-${slugs[buyNode]}-${slugs[sellNode]}`,
                resourceId: resource.resourceId,
                resourceName: resource.resourceName,
                buyNode,
                sellNode,
                buyPrice: prices[buyNode][resource.resourceName],
                sellPrice: prices[sellNode][resource.resourceName],
                maxQuantity: 1000
              }));
            }));
          })()
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

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        cargo.Iron = 0;
        cargo["Crystal Shards"] = 0;
        cargo.Copper = 24;
        delete cargoCostBasis.Copper;
        selectedMarketResource = "Copper";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 24;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    const builder = page.locator("#marketScreen .market-builder-panel");
    await expect(builder).toContainText("Server Sell");
    await expect(builder).toContainText("Recovered resource");
    await expect(builder).toContainText("Mined cargo");
    await expect(builder).toContainText(/Sell 24 of 24 carried/);
    await expect(builder).toContainText("Sell Revenue");
    await expect(builder).toContainText("CR 1,200");
    await expect(builder).toContainText("Recovered Value");
    await expect(builder).not.toContainText(/Virella > Nyxara/);

    await page.evaluate(() => {
      if (typeof window.showMultiplayerStagingTradeSellFeedback === "function") {
        window.showMultiplayerStagingTradeSellFeedback({
          applied: true,
          operation: "sell",
          resourceName: "Iron",
          quantity: 310,
          revenue: 9300,
          creditsDelta: 9300,
          cargoDelta: -310,
          sellNode: "Virella",
          cargoCostBasisBefore: 15,
          recoveredResourceSale: false
        });
      }
    });
    await expect(page.locator("#tradeResultBurst")).toContainText("Trade Complete");
    await expect(page.locator("#tradeResultBurst")).toContainText("+CR 4,650");
    await expect(page.locator("#tradeResultBurst")).toContainText("Sold 310 Iron at Virella");

    await page.evaluate(() => {
      if (typeof window.showMultiplayerStagingTradeSellFeedback === "function") {
        window.showMultiplayerStagingTradeSellFeedback({
          applied: true,
          operation: "sell",
          resourceName: "Copper",
          quantity: 24,
          revenue: 1200,
          creditsDelta: 1200,
          cargoDelta: -24,
          sellNode: "Nyxara",
          cargoCostBasisBefore: null,
          recoveredResourceSale: true
        });
      }
    });
    await expect(page.locator("#tradeResultBurst")).toContainText("Recovered Cargo Sold");
    await expect(page.locator("#tradeResultBurst")).toContainText("+CR 1,200 value");
    await expect(page.locator("#tradeResultBurst")).toContainText("Sold 24 Copper at Nyxara");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store shows server-backed dry-run wording", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openStore(page);

    await expect(page.locator("#storeScreen")).toContainText(/Staging Purchase|Server Preview|Server preview unavailable/);
    await expect(page.locator("#storeScreen")).not.toContainText(/LF-2 Hauler|Hauler/i);
    await expect(page.locator("#storeScreen")).toContainText(/Pulse Laser/i);
    await expect(page.locator("#storeScreen")).toContainText(/Shield Booster/i);
    await expect(page.locator("#storeScreen")).toContainText(/Lupen Shard/i);
    await expect(page.locator("#storeScreen")).toContainText(/Lupen Core/i);
    await expect(page.locator("#storeScreen")).toContainText(/Materials/i);
    await expect(page.locator("#storeScreen")).toContainText(/Apply Cargo Pod|Cargo Pod equip preview|server-backed validation/i);
    await expect(page.locator("#storeScreen")).toContainText(/server-backed validation|server preview only|Real Store purchase is blocked|No CR or inventory changed/i);
    await expect(page.locator("#storeScreen")).not.toContainText("Buy / CR");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("station store detail art stays centered and prominent", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openStore(page);

    const measurements = await page.evaluate(async () => {
      const items = [
        ["cargoPod", "attachment:cargoPod"],
        ["ionBlaster", "gun:ionBlaster"],
        ["heavyLance", "gun:heavyLance"],
        ["lupenCore", "core:lupenCore"],
        ["lupenShards", "material:lupenShard"]
      ];
      const rows = [];
      for (const [key, id] of items) {
        window.selectStoreItem(id);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const frame = document.querySelector(".store-detail-visual");
        const item = frame?.querySelector(".quality-fx__item, img");
        const button = document.querySelector(".store-detail-buy-action");
        const frameRect = frame?.getBoundingClientRect();
        const itemRect = item?.getBoundingClientRect();
        rows.push({
          key,
          frameHeight: frameRect?.height || 0,
          itemHeight: itemRect?.height || 0,
          offsetX: itemRect && frameRect ? Math.abs((itemRect.left + itemRect.width / 2) - (frameRect.left + frameRect.width / 2)) : 999,
          offsetY: itemRect && frameRect ? Math.abs((itemRect.top + itemRect.height / 2) - (frameRect.top + frameRect.height / 2)) : 999,
          actionText: button?.textContent?.trim() || "",
          actionDisabled: button?.disabled === true
        });
      }
      return rows;
    });

    for (const row of measurements) {
      expect(row.frameHeight, row.key).toBeGreaterThanOrEqual(145);
      expect(row.itemHeight, row.key).toBeGreaterThanOrEqual(row.key === "lupenShards" ? 95 : 110);
      expect(row.offsetX, row.key).toBeLessThanOrEqual(1);
      expect(row.offsetY, row.key).toBeLessThanOrEqual(1);
      expect(row.actionText, row.key).not.toBe("");
      expect(row.actionDisabled, row.key).toBe(false);
    }

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("hangar loadout shows selected-item actions without live writes", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openHangar(page);
    await expect(page.locator("#hangarOverviewSection")).toHaveClass(/active/);

    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Weapon 02");
    await expect(page.locator("#hangarScreen")).toContainText("Vault Equipment");
    await expect(page.locator("#hangarScreen")).toContainText("Selected Slot: Weapon 02");
    await expect(page.locator("#hangarScreen")).toContainText("Guns");
    await expect(page.locator("#hangarScreen")).toContainText("Attachments");
    await expect(page.locator("#hangarScreen")).not.toContainText("Total Slots");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("ship switching restores each hull condition instead of inheriting previous hull", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "falcon";
        ownedShips = ["falcon", "bison", "monolith"];
        shipLoadouts = {
          falcon: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, "falcon"),
          bison: normalizeShipLoadout({ attachments: [], guns: [] }, "bison"),
          monolith: normalizeShipLoadout({ attachments: [], guns: [] }, "monolith")
        };
        shipConditions = {
          falcon: { hull: 620, shield: 111 },
          bison: { hull: 930, shield: 77 }
        };
        hull = 620;
        shield = 111;
        applyShipStats(false);
        equipShip("monolith");
      `);
      const monolith = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      window.eval(`equipShip("bison");`);
      const bisonBeforeRepair = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      window.eval(`repairCurrentShip();`);
      const bisonAfterRepair = { ship: currentShipId, hull, hullMax, shield, shieldMax, savedHull: shipConditions.bison.hull };
      window.eval(`equipShip("falcon");`);
      const falcon = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      return { monolith, bisonBeforeRepair, bisonAfterRepair, falcon };
    });

    expect(state.monolith).toMatchObject({ ship: "monolith", hull: 4200, hullMax: 4200, shield: 1800, shieldMax: 1800 });
    expect(state.bisonBeforeRepair).toMatchObject({ ship: "bison", hull: 930, hullMax: 1300, shield: 77, shieldMax: 135 });
    expect(state.bisonAfterRepair).toMatchObject({ ship: "bison", hull: 1300, hullMax: 1300, savedHull: 1300 });
    expect(state.falcon).toMatchObject({ ship: "falcon", hull: 620, hullMax: 700, shield: 111, shieldMax: 220 });
    expect(state.monolith.armor).toBe(70);
    expect(state.bisonBeforeRepair.cargo).toBe(260);
    expect(state.falcon.jumpRecharge).toBe(15);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("hangar loadout explicitly equips and unequips selected weapon and attachment slots", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        ownedGuns.pulseLaser = 1;
        ownedGuns.repeater = 1;
        ownedGuns.meltCannon = 1;
        ownedGuns.ionBlaster = 1;
        ownedAttachments.cargoPod = 1;
        ownedAttachments.shieldBooster = 1;
        ownedAttachments.hullBooster = 1;
        ownedAttachments.jumpDrive = 1;
        shipLoadouts[STARTER_SHIP_ID] = { attachments: [], guns: [] };
        showScreen("gameScreen");
        openHangar();
        showHangarSection("overview");
        saveGame();
      `);
    });
    await expect(page.locator("#hangarScreen")).toHaveClass(/active/);
    await expect(page.locator(".loadout-vault-filters button")).toHaveCount(2);

    await page.locator("#loadoutVaultFilterGuns").click();
    await expect(page.locator("#loadoutCategoryWeapons")).toHaveClass(/active/);
    await page.locator("#installedGuns .loadout-grid-slot.empty").first().click();
    await expect(page.locator("#gunInventory .hangar-equipment-card")).toHaveCount(4);
    await expect.poll(async () => page.locator("#gunInventory .hangar-equipment-card").evaluateAll((rows, selector) => {
      const list = document.querySelector(selector);
      if (!list) return 0;
      const listRect = list.getBoundingClientRect();
      return rows.filter(row => {
        const rect = row.getBoundingClientRect();
        return rect.top >= listRect.top && rect.bottom <= listRect.bottom;
      }).length;
    }, "#gunInventory")).toBeGreaterThanOrEqual(3);
    await page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']").first().click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Pulse Laser");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);

    await page.locator("#installedGuns .loadout-grid-slot.filled").first().click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled").first()).toHaveClass(/selected/);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Pulse Laser");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']")).toHaveCount(1);

    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#loadoutCategoryAttachments")).toHaveClass(/active/);
    await page.locator("#installedAttachments .loadout-grid-slot.empty").first().click();
    await expect(page.locator("#gunInventory .hangar-equipment-card")).toHaveCount(4);
    await expect.poll(async () => page.locator("#gunInventory .hangar-equipment-card").evaluateAll((rows, selector) => {
      const list = document.querySelector(selector);
      if (!list) return 0;
      const listRect = list.getBoundingClientRect();
      return rows.filter(row => {
        const rect = row.getBoundingClientRect();
        return rect.top >= listRect.top && rect.bottom <= listRect.bottom;
      }).length;
    }, "#gunInventory")).toBeGreaterThanOrEqual(3);
    await page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']").first().click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Cargo Pod");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true }).click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(1);

    await page.locator("#loadoutVaultFilterAttachments").click();
    await page.locator("#installedAttachments .loadout-grid-slot.filled").first().click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled").first()).toHaveClass(/selected/);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Cargo Pod");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" }).click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']")).toHaveCount(1);

    await page.evaluate(() => {
      window.eval(`
        currentShipId = "monolith";
        selectedHangarShipId = "monolith";
        ownedShips = [STARTER_SHIP_ID, "monolith"];
        shipLoadouts.monolith = { attachments: [], guns: [] };
        showScreen("gameScreen");
        openHangar();
        showHangarSection("overview");
      `);
    });
    await expect(page.locator("#installedGuns .loadout-grid-slot.empty")).toHaveCount(20);
    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.empty")).toHaveCount(20);

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
