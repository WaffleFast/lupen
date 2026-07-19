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
    credits = 100000;
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
    await expect(page.locator("#shipyardCreditText")).toHaveText("100,000");
    await expect(page.locator("#shipShop .vessel-exchange-card")).toHaveCount(4);
    await page.locator("#shipShop .vessel-exchange-card[data-ship-id='monolith']").click();
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Pioneer Moth");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Ship Stats");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Weapon Slots");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Equipment Slots");
    await expect(page.locator("#shipyardDetailPanel .buy-ship-action")).toHaveText("Buy Hull");
    await expect(page.locator("#shipyardDetailPanel .shipyard-price-action")).toHaveText("CR 48,000");

    const layout = await page.locator("#hangarShipyardSection .vessel-exchange-layout").evaluate(shell => {
      const catalogue = shell.querySelector(".exchange-catalog-panel")?.getBoundingClientRect();
      const workspace = shell.querySelector(".exchange-vessel-workspace")?.getBoundingClientRect();
      const cards = [...shell.querySelectorAll("#shipShop .vessel-exchange-card")].map(card => card.getBoundingClientRect());
      const presentation = shell.querySelector(".exchange-selected-presentation")?.getBoundingClientRect();
      const art = shell.querySelector(".exchange-selected-presentation img")?.getBoundingClientRect();
      return {
        columns: Boolean(catalogue && workspace && catalogue.right < workspace.left),
        cardsFit: Boolean(catalogue && cards.every(card => card.top >= catalogue.top - 1 && card.bottom <= catalogue.bottom + 1)),
        artFits: Boolean(presentation && art && art.left >= presentation.left - 1 && art.right <= presentation.right + 1 && art.top >= presentation.top - 1 && art.bottom <= presentation.bottom + 1)
      };
    });
    expect(layout).toEqual({ columns: true, cardsFit: true, artFits: true });

    await page.mouse.move(10, 10);
    await page.screenshot({ path: "artifacts/vessel-exchange-redesign.png", fullPage: false });
    await page.locator("#shipyardDetailPanel .buy-ship-action").click();
    await expect(page.locator("#shipShop .vessel-exchange-card[data-ship-id='monolith']")).toHaveClass(/owned/);
    await expect(page.locator("#shipyardDetailPanel .set-active-ship-action")).toHaveText("Set Active");
    await expect.poll(() => page.evaluate(() => credits)).toBe(52000);
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
    await expect(page.locator("#vaultDetailPanel")).toContainText("Pulse Laser");

    await page.locator("#vaultSearchInput").fill("");
    await page.locator("#vaultFilterAll").click();
    await expect(page.locator("#vaultCatalogGrid .vault-storage-card")).toHaveCount(5);
    await page.screenshot({ path: "artifacts/vault-library-redesign.png", fullPage: false });
  });
});
