const { test, expect } = require("@playwright/test");

async function waitForGameGlobals(page) {
  await page.waitForFunction(() => typeof window.openUpgradeForge === "function", null, { timeout: 15000 });
}

test.describe("shared item-rarity presentation", () => {
  test.use({ viewport: { width: 1228, height: 731 } });

  test("uses the same five-tier contract in Forge, Vault, and Loadout", async ({ page }) => {
    const browserErrors = [];
    page.on("pageerror", error => browserErrors.push(error.message));
    await page.goto("/");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        ownedShips = ["falcon"];
        ownedAttachments = {};
        ownedGuns = { ...ownedGuns, pulseLaser: 0, ionBlaster: 0, heavyLance: 0 };
        inventoryItems = [1, 2, 3, 4, 5].map(level => ({
          id: "rarity-visual-" + level,
          key: "pulseLaser",
          quality: "standard",
          level
        }));
        shipLoadouts = {
          falcon: normalizeShipLoadout({
            attachments: [],
            guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)]
          }, "falcon")
        };
        playerProgress = normalizePlayerProgress({ combatXp: 6000 });
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 10 });
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        selectedForgeItemId = "inventory:rarity-visual-4";
        openUpgradeForge();
      })()
    `));

    const ownedCards = page.locator("#forgeSelectedPanel .forge-owned-item");
    await expect(ownedCards).toHaveCount(6);
    for (const key of ["common", "refined", "unique", "elite", "super"]) {
      await expect(page.locator(`#forgeSelectedPanel .forge-owned-item[data-rarity='${key}']`).first()).toBeVisible();
    }
    await expect(page.locator("#forgeSelectedPanel .forge-owned-item.selected")).toHaveAttribute("data-rarity", "elite");
    await expect(page.locator("#forgeChamber")).toHaveAttribute("data-rarity", "elite");
    await expect(page.locator("#forgeChamber")).not.toHaveClass(/forge-complete/);
    await page.screenshot({ path: "artifacts/item-rarity-forge-1228x731.png", fullPage: false });

    const forgeTokens = await page.locator("#forgeChamber").evaluate(node => {
      const styles = getComputedStyle(node);
      return {
        color: styles.getPropertyValue("--rarity-color").trim(),
        rgb: styles.getPropertyValue("--rarity-rgb").trim(),
        intensity: styles.getPropertyValue("--rarity-intensity").trim()
      };
    });
    expect(forgeTokens).toEqual({ color: "#ffd45e", rgb: "255, 212, 94", intensity: "0.72" });

    await page.evaluate(() => window.eval(`
      selectedHangarShipId = "falcon";
      selectedFleetShipId = "falcon";
      selectedLoadoutSlotCategory = "guns";
      selectedLoadoutVaultFilter = "guns";
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    `));
    const filledSlot = page.locator("#installedGuns .loadout-grid-slot.filled").first();
    const emptySlot = page.locator("#installedGuns .loadout-grid-slot.empty").first();
    await expect(filledSlot).toHaveAttribute("data-rarity", "common");
    await expect(emptySlot).not.toHaveAttribute("data-rarity", /.+/);
    await expect(page.locator("#gunInventory .loadout-vault-row[data-rarity='super']")).toBeVisible();
    await page.screenshot({ path: "artifacts/item-rarity-loadout-1228x731.png", fullPage: false });

    await page.evaluate(() => window.showHangarSection("vault"));
    const superVaultCard = page.locator("#vaultCatalogGrid .vault-storage-card[data-rarity='super']");
    await expect(superVaultCard).toBeVisible();
    await superVaultCard.click();
    await expect(page.locator("#vaultDetailPanel .vault-item-detail-shell")).toHaveAttribute("data-rarity", "super");
    await page.mouse.move(1210, 715);
    await page.screenshot({ path: "artifacts/item-rarity-vault-1228x731.png", fullPage: false });

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotion = await page.locator("#vaultDetailPanel .vault-item-preview").evaluate(node => ({
      self: getComputedStyle(node).animationName,
      after: getComputedStyle(node, "::after").animationName
    }));
    expect(reducedMotion).toEqual({ self: "none", after: "none" });
    expect(browserErrors).toEqual([]);
  });
});
