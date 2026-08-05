const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

async function openHangarSection(page, section, setup = "") {
  await page.goto("/");
  await waitForGame(page);
  await page.evaluate(({ section, setup }) => window.eval(`(() => {
    localStorage.clear();
    currentShipId = "falcon";
    selectedHangarShipId = "falcon";
    selectedFleetShipId = "falcon";
    ownedShips = ["falcon"];
    credits = 250000;
    ensureShipCondition("falcon");
    applyShipStats(false);
    ${setup}
    showScreen("gameScreen");
    openHangar();
    showHangarSection("${section}");
  })()`), { section, setup });
}

test.describe("Hangar Exchange and Vault redesign", () => {
  test("presents the Vessel Exchange as a compact hull catalogue and purchase workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openHangarSection(page, "shipyard", 'selectedShipyardShipId = "monolith";');

    await expect(page.locator("#hangarShipyardSection")).toHaveClass(/active/);
    await expect(page.locator("#hangarShipyardSection .shipyard-title-row")).toContainText("Select an available hull");
    await expect(page.locator("#shipyardCreditText")).toHaveText("250,000");
    await expect(page.locator("#shipShop .vessel-exchange-card")).toHaveCount(3);
    await expect(page.locator("#shipShop .vessel-exchange-card img")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => ({
      falcon: SHIPS.falcon.price,
      bison: SHIPS.bison.price,
      zeusExplorer: SHIPS.zeusExplorer.price,
      monolith: SHIPS.monolith.price
    }))).toEqual({
      falcon: 0,
      bison: 24000,
      zeusExplorer: 66000,
      monolith: 240000
    });
    await page.locator("#shipShop .vessel-exchange-card[data-ship-id='monolith']").click();
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Pioneer Behemoth");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Ship Stats");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Weapon Slots");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Equipment Slots");
    await expect(page.locator("#shipyardDetailPanel .buy-ship-action")).toHaveText("Buy Hull");
    await expect(page.locator("#shipyardDetailPanel .shipyard-price-action")).toHaveText("CR 240,000");
    await expect(page.locator("#shipyardDetailPanel .exchange-purchase-summary")).toContainText("Purchase Price");
    await expect(page.locator("#shipyardDetailPanel .exchange-purchase-summary .is-purchase-price")).toHaveText("CR 240,000");

    const layout = await page.locator("#hangarShipyardSection .vessel-exchange-layout").evaluate(shell => {
      const catalogue = shell.querySelector(".exchange-catalog-panel")?.getBoundingClientRect();
      const workspace = shell.querySelector(".exchange-vessel-workspace")?.getBoundingClientRect();
      const cards = [...shell.querySelectorAll("#shipShop .vessel-exchange-card")].map(card => card.getBoundingClientRect());
      const presentation = shell.querySelector(".exchange-selected-presentation")?.getBoundingClientRect();
      const art = shell.querySelector(".exchange-selected-presentation img")?.getBoundingClientRect();
      return {
        columns: Boolean(catalogue && workspace && catalogue.right < workspace.left),
        cardsFit: Boolean(catalogue && cards.every(card => card.top >= catalogue.top - 1 && card.bottom <= catalogue.bottom + 1)),
        artFits: Boolean(presentation && art && art.left >= presentation.left - 1 && art.right <= presentation.right + 1 && art.top >= presentation.top - 1 && art.bottom <= presentation.bottom + 1),
        presentationWidthRatio: presentation && workspace ? presentation.width / workspace.width : 0
      };
    });
    expect(layout.columns).toBe(true);
    expect(layout.cardsFit).toBe(true);
    expect(layout.artFits).toBe(true);
    expect(layout.presentationWidthRatio).toBeGreaterThan(0.9);

    const catalogueCopy = await page.locator("#shipShop .vessel-exchange-card").evaluateAll(cards => cards.map(card => {
      const outer = card.getBoundingClientRect();
      const copy = [".fleet-card-role", ".fleet-card-name", ".vessel-card-description"]
        .map(selector => card.querySelector(selector)?.getBoundingClientRect())
        .filter(rect => rect && rect.width > 0 && rect.height > 0);
      return {
        contained: copy.every(rect => rect.top >= outer.top + 1 && rect.bottom <= outer.bottom - 1 && rect.left >= outer.left + 1 && rect.right <= outer.right - 1),
        ordered: copy.every((rect, index) => index === 0 || rect.top >= copy[index - 1].bottom - 1)
      };
    }));
    expect(catalogueCopy.every(item => item.contained && item.ordered)).toBe(true);

    await page.mouse.move(10, 10);
    await page.screenshot({ path: "artifacts/vessel-exchange-redesign.png", fullPage: false });
    await page.locator("#shipyardDetailPanel .buy-ship-action").click();
    await expect(page.locator("#shipShop .vessel-exchange-card[data-ship-id='monolith']")).toHaveCount(0);
    await expect(page.locator("#shipShop .vessel-exchange-card")).toHaveCount(2);
    await expect.poll(() => page.evaluate(() => credits)).toBe(10000);
  });

  test("applies a priced staging hull purchase from the Vessel Exchange", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGame(page);

    await page.evaluate(() => window.eval(`(() => {
      localStorage.clear();
      currentNode = "Asteron Prime";
      lastPlanetNode = "Asteron Prime";
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      selectedFleetShipId = "falcon";
      ownedShips = ["falcon"];
      credits = 100000;
      ensureShipCondition("falcon");
      applyShipStats(false);

      const subscribers = [];
      const status = {
        enabled: true,
        isConnected: true,
        currentNode: "Asteron Prime",
        playerServerNode: "Asteron Prime",
        presenceStatus: "docked",
        lastStagingStoreItems: {
          ok: true,
          items: [{
            itemId: "ship:zeusExplorer",
            name: "Pioneer Destroyer",
            category: "ship",
            localKind: "ship",
            localKey: "zeusExplorer",
            price: 66000,
            levelRequirement: 0,
            stockType: "fixed"
          }]
        },
        lastStagingStorePreview: null,
        lastStagingStorePurchase: null
      };

      window.__stagingHullPurchasePayloads = [];
      window.LupenMultiplayerClient = {
        getStatus: () => status,
        onServerState: callback => {
          subscribers.push(callback);
          return { unsubscribe: () => {} };
        },
        requestStagingStoreItems: () => true,
        previewStagingStorePurchase: () => true,
        sendMovementIntent: () => true,
        purchaseStagingStoreItem: payload => {
          window.__stagingHullPurchasePayloads.push({ ...payload });
          setTimeout(() => {
            status.lastStagingStorePurchase = {
              ok: true,
              mode: "store_write",
              operation: "purchase",
              applied: true,
              dryRun: false,
              itemId: "ship:zeusExplorer",
              name: "Pioneer Destroyer",
              category: "ship",
              localKind: "ship",
              localKey: "zeusExplorer",
              quantity: 1,
              unitPrice: 66000,
              totalCost: 66000,
              creditsBefore: 100000,
              creditsAfter: 34000,
              itemBefore: 0,
              itemAfter: 1,
              wouldPass: true,
              validationMode: "trusted_save",
              trustedStateAvailable: true,
              snapshotUsed: false,
              creditsWritten: true,
              shipWritten: true,
              saveWritten: true,
              writes: { creditsWritten: true, shipWritten: true, saveWritten: true },
              currentNode: "Asteron Prime",
              requestedNode: "Asteron Prime",
              presenceStatus: "docked",
              receivedAt: Date.now()
            };
            subscribers.forEach(callback => callback({}));
          }, 120);
          return true;
        }
      };

      showScreen("gameScreen");
      openHangar();
      selectedShipyardShipId = "zeusExplorer";
      showHangarSection("shipyard");
    })()`));

    await expect(page.locator("#shipyardDetailPanel .buy-ship-action")).toHaveText("Buy Hull");
    await expect(page.locator("#shipyardDetailPanel .shipyard-price-action")).toHaveText("CR 66,000");
    await page.locator("#shipyardDetailPanel .buy-ship-action").click();

    await expect.poll(() => page.evaluate(() => ownedShips.includes("zeusExplorer"))).toBe(true);
    await expect(page.locator("#shipShop .vessel-exchange-card[data-ship-id='zeusExplorer']")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => credits)).toBe(34000);
    await expect.poll(() => page.evaluate(() => window.__stagingHullPurchasePayloads[0])).toMatchObject({
      itemId: "ship:zeusExplorer",
      quantity: 1,
      currentNode: "Asteron Prime",
      presenceStatus: "docked"
    });
  });

  test("presents the Vault as a searchable equipment library with focused detail", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openHangarSection(page, "vault", `
      ownedGuns = { ...ownedGuns, pulseLaser: 1 };
      ownedAttachments = { ...ownedAttachments, cargoPod: 1 };
      inventoryItems = [
        { id: "vault-ion-refined", key: "ionBlaster", quality: "standard", level: 2 },
        { id: "vault-drive-elite", key: "jumpDrive", quality: "standard", level: 4 }
      ];
      upgradeMaterials = { ...upgradeMaterials, lupenShards: 210 };
      hangarVaultFilter = "all";
      selectedVaultSearch = "";
      selectedVaultSort = "quality";
      selectedVaultGroupKey = null;
    `);

    await expect(page.locator("#hangarVaultSection")).toHaveClass(/active/);
    await expect(page.locator("#hangarVaultSection .vault-title-row")).toContainText("Browse stored equipment");
    await expect(page.locator("#vaultFilterBar .vault-filter-btn")).toHaveCount(4);
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(5);
    await expect(page.locator("#vaultDetailPanel .vault-item-detail-shell")).toBeVisible();

    const shardCard = page.locator("#vaultCatalogGrid .vault-storage-card.resource-entry").filter({ hasText: "Lupen Shard" });
    await expect(shardCard).toHaveCount(1);
    await expect(shardCard).toContainText("x210");
    const shardLayout = await shardCard.evaluate(card => {
      const art = card.querySelector(".vault-storage-art")?.getBoundingClientRect();
      const copy = card.querySelector(".vault-storage-copy")?.getBoundingClientRect();
      const count = card.querySelector(".vault-card-count")?.getBoundingClientRect();
      const name = card.querySelector(".vault-storage-copy strong");
      return {
        ordered: Boolean(art && copy && count && art.right <= copy.left + 1 && copy.right <= count.left + 1),
        nameFits: Boolean(name && name.scrollWidth <= name.clientWidth + 1)
      };
    });
    expect(shardLayout).toEqual({ ordered: true, nameFits: true });

    await shardCard.click();
    await expect(shardCard).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#vaultDetailPanel .vault-resource-use")).toContainText("Raise equipment levels");
    await expect(page.locator("#vaultDetailPanel .vault-resource-use button")).toHaveText("Open Forge");
    await page.mouse.move(4, 4);
    await page.screenshot({ path: "artifacts/vault-library-material-selected.png", fullPage: false });

    const layout = await page.locator("#hangarVaultSection .station-vault-layout").evaluate(shell => {
      const index = shell.querySelector(".vault-index-panel")?.getBoundingClientRect();
      const workspace = shell.querySelector(".vault-workspace-panel")?.getBoundingClientRect();
      const detail = shell.querySelector(".vault-selection-panel")?.getBoundingClientRect();
      return {
        columns: Boolean(index && workspace && index.right < workspace.left),
        detailFits: Boolean(workspace && detail && detail.left >= workspace.left - 1 && detail.right <= workspace.right + 1 && detail.bottom <= workspace.bottom + 1)
      };
    });
    expect(layout).toEqual({ columns: true, detailFits: true });

    await page.locator("#vaultFilterGuns").click();
    await expect(page.locator("#vaultFilterGuns")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(2);

    await page.locator("#vaultSearchInput").fill("Pulse");
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(1);
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toContainText("Pulse Laser");
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toContainText("1 stored · 1 equipped");
    await expect(page.locator("#vaultDetailPanel")).toContainText("Pulse Laser");

    await page.locator("#vaultSearchInput").fill("");
    await page.locator("#vaultFilterAll").click();
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(5);
    await page.screenshot({ path: "artifacts/vault-library-redesign.png", fullPage: false });

    await shardCard.click();
    await page.locator("#vaultDetailPanel .vault-resource-use button").click();
    await expect(page.locator("#upgradeForgeScreen")).toBeVisible();
  });

  test("keeps equipped-only gear visible in the owned equipment library", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openHangarSection(page, "vault", `
      ownedGuns = { ...ownedGuns, pulseLaser: 0 };
      inventoryItems = [];
      shipLoadouts.falcon = { guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)], attachments: [] };
      hangarVaultFilter = "guns";
      selectedVaultSearch = "";
      selectedVaultGroupKey = null;
    `);

    const pulseCard = page.locator("#vaultCatalogGrid .vault-storage-card").filter({ hasText: "Pulse Laser" });
    await expect(pulseCard).toHaveCount(1);
    await expect(pulseCard).toContainText("0 stored · 1 equipped");
    await pulseCard.click();
    await expect(page.locator("#vaultDetailPanel")).toContainText("Stored");
    await expect(page.locator("#vaultDetailPanel")).toContainText("Equipped");
    await page.locator("#vaultStatusSelect").selectOption("stored");
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(0);
  });

  test("keeps a thirty-variant Vault browsable, grouped, and connected to Loadout", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 768 });
    await openHangarSection(page, "vault", `
      ownedGuns = {};
      ownedAttachments = {};
      upgradeMaterials = { lupenShards: 0 };
      const vaultKeys = ["pulseLaser", "ionBlaster", "heavyLance", "meltCannon", "repeater", "ripperGun", "voidRail", "cargoPod", "hullBooster", "jumpDrive", "shieldBooster", "evasionMatrix"];
      const vaultQualities = ["standard", "refined", "advanced"];
      inventoryItems = Array.from({ length: 30 }, (_, index) => ({
        id: \`vault-populated-\${index}\`,
        key: vaultKeys[index % vaultKeys.length],
        quality: vaultQualities[Math.floor(index / vaultKeys.length)],
        level: (index % 5) + 1
      }));
      inventoryItems.push(
        { id: "vault-pulse-copy-a", key: "pulseLaser", quality: "standard", level: 1 },
        { id: "vault-pulse-copy-b", key: "pulseLaser", quality: "standard", level: 1 }
      );
      shipLoadouts.falcon = { guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)], attachments: [] };
      hangarVaultFilter = "all";
      selectedVaultSearch = "";
      selectedVaultSort = "quality";
      selectedVaultQuality = "all";
      selectedVaultStatus = "all";
      selectedVaultGroupKey = null;
    `);

    const cards = page.locator("#vaultCatalogGrid .vault-storage-card");
    await expect(cards).toHaveCount(30);
    await expect(page.locator("#vaultCapacityText")).toContainText("Gear Storage");
    await expect(page.locator("#vaultCapacityText")).toContainText("32 / 50");

    const grid = await cards.evaluateAll(items => {
      const rects = items.slice(0, 4).map(item => item.getBoundingClientRect());
      const catalog = items[0]?.parentElement?.getBoundingClientRect();
      const visible = items.filter(item => {
        const rect = item.getBoundingClientRect();
        return catalog && rect.top >= catalog.top - 1 && rect.bottom <= catalog.bottom + 1;
      }).length;
      return {
        firstRowAligned: Math.max(...rects.slice(0, 3).map(rect => rect.top)) - Math.min(...rects.slice(0, 3).map(rect => rect.top)) < 2,
        fourthStartsNextRow: rects[3].top > rects[0].top + 20,
        visible
      };
    });
    expect(grid.firstRowAligned).toBe(true);
    expect(grid.fourthStartsNextRow).toBe(true);
    expect(grid.visible).toBeGreaterThanOrEqual(6);
    await page.mouse.move(4, 4);
    await page.screenshot({ path: "artifacts/vault-library-populated.png", fullPage: false });

    await page.locator("#vaultSearchInput").fill("Pulse Laser");
    await expect(cards).toHaveCount(3);
    const standardPulse = cards.filter({ hasText: "Standard" });
    await expect(standardPulse).toHaveCount(1);
    await expect(standardPulse).toContainText("3 stored · 1 equipped");
    await standardPulse.click();
    await expect(page.locator("#vaultDetailPanel")).toContainText("Fire Rate");
    await expect(page.locator("#vaultDetailPanel")).toContainText("DPS");
    await expect(page.locator("#vaultDetailPanel")).toContainText("Pioneer Hunter · Weapon 01");

    await page.locator("#vaultSearchInput").fill("");
    await page.locator("#vaultQualitySelect").selectOption("refined");
    await expect(cards).toHaveCount(12);
    await page.locator("#vaultQualitySelect").selectOption("all");
    await page.locator("#vaultStatusSelect").selectOption("equipped");
    await expect(cards).toHaveCount(1);
    await page.mouse.move(4, 4);
    await page.screenshot({ path: "artifacts/vault-library-equipped-filter.png", fullPage: false });

    await page.locator("#vaultDetailPanel .vault-equipped-location button").click();
    await expect(page.locator("#hangarOverviewSection")).toHaveClass(/active/);
    await expect(page.locator("#hangarOverviewSection")).toContainText("Pulse Laser");
  });
});
