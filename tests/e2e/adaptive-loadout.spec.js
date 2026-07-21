const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

async function openAdaptiveLoadout(page, setup) {
  await page.goto("/");
  await waitForGame(page);
  await page.evaluate(setup);
}

test.describe("Adaptive Hangar Loadout", () => {
  test("uses spacious cards and only the Hunter's real slots", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      ownedShips = ["falcon"];
      playerProgress.combatXp = 100000;
      ownedGuns.heavyLance = 1;
      ownedGuns.repeater = 1;
      ownedGuns.meltCannon = 1;
      shipLoadouts.falcon = {
        guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)],
        attachments: [makeLeveledLoadoutEntry("cargoPod", "standard", 1), makeLeveledLoadoutEntry("jumpDrive", "refined", 2)]
      };
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await expect(page.locator(".adaptive-loadout-shell")).toBeVisible();
    await expect(page.locator("#installedGuns .loadout-grid-slot")).toHaveCount(2);
    await expect(page.locator("#installedGuns")).toHaveClass(/spacious-slots/);
    await expect(page.locator("#installedGuns .loadout-grid-slot.locked")).toHaveCount(0);
    await expect(page.locator("#loadoutFittedSummary")).toHaveText("3 / 4 slots fitted");
    await expect(page.locator("#overviewShipRole")).toHaveText("Attacker / Interceptor");
    await expect(page.locator("#installedGuns .loadout-slot-copy")).toHaveCount(1);
    await expect(page.locator(".weapon-slot-bank .loadout-bank-title")).toBeVisible();
    await expect(page.locator(".weapon-slot-bank .loadout-bank-title")).toContainText("Weapon Hardpoints");
    await expect(page.locator("#gunSlotSummary")).toHaveText("1 / 2 EQUIPPED");
    await expect(page.locator(".attachment-slot-bank")).not.toBeVisible();
    await expect(page.locator("#installedGuns .loadout-grid-slot.empty .slot-empty-label")).toContainText("Empty Weapon 02");

    const spaciousRack = await page.locator("#installedGuns").evaluate(grid => {
      const rack = grid.getBoundingClientRect();
      const workspace = grid.closest(".adaptive-slot-workspace").getBoundingClientRect();
      const filledSlot = grid.querySelector(".loadout-grid-slot.filled").getBoundingClientRect();
      const art = grid.querySelector(".loadout-grid-slot.filled .quality-fx__item").getBoundingClientRect();
      return {
        rackWidth: rack.width,
        workspaceWidth: workspace.width,
        artworkContained: art.left >= filledSlot.left - 1
          && art.right <= filledSlot.right + 1
          && art.top >= filledSlot.top - 1
          && art.bottom <= filledSlot.bottom + 1
      };
    });
    expect(spaciousRack.rackWidth).toBeLessThanOrEqual(540);
    expect(spaciousRack.rackWidth).toBeLessThan(spaciousRack.workspaceWidth);
    expect(spaciousRack.artworkContained).toBe(true);

    await page.locator("#installedGuns .loadout-grid-slot").first().click();

    const selectedStats = page.locator("#loadoutItemDetailPanel .loadout-selected-item-stats > div");
    await expect(selectedStats).toHaveCount(3);
    const selectedStatStyles = await selectedStats.evaluateAll(nodes => nodes.map(node => {
      const value = node.querySelector("strong");
      const style = getComputedStyle(value);
      return { color: style.color, fontSize: Number.parseFloat(style.fontSize) };
    }));
    expect(selectedStatStyles.every(stat => stat.fontSize >= 14)).toBe(true);
    expect(new Set(selectedStatStyles.map(stat => stat.color)).size).toBe(3);
    await expect(page.locator(".compatible-vault-actions #loadoutVaultResults")).toHaveText("3 weapon variations");
    const libraryGeometry = await page.locator("#gunInventory .loadout-vault-row").first().evaluate(card => {
      const cardRect = card.getBoundingClientRect();
      const buttonRect = card.querySelector(".loadout-vault-equip-action").getBoundingClientRect();
      const copyRect = card.querySelector(".loadout-vault-row-copy").getBoundingClientRect();
      return { cardTop: cardRect.top, cardBottom: cardRect.bottom, copyBottom: copyRect.bottom, buttonTop: buttonRect.top, buttonBottom: buttonRect.bottom };
    });
    expect(libraryGeometry.buttonTop).toBeGreaterThanOrEqual(libraryGeometry.cardTop);
    expect(libraryGeometry.buttonBottom).toBeLessThanOrEqual(libraryGeometry.cardBottom + 1);
    expect(libraryGeometry.copyBottom).toBeLessThanOrEqual(libraryGeometry.buttonTop + 1);

    await page.locator("#loadoutCategoryAttachments").click();
    await expect(page.locator(".weapon-slot-bank")).not.toBeVisible();
    await expect(page.locator(".attachment-slot-bank .loadout-bank-title")).toBeVisible();
    await expect(page.locator(".attachment-slot-bank .loadout-bank-title")).toContainText("Equipment Mounts");
    await expect(page.locator("#installedAttachments .loadout-grid-slot")).toHaveCount(2);
    const attachmentNames = await page.locator("#installedAttachments img").evaluateAll(images => images.map(image => image.alt));
    expect(attachmentNames).toEqual(["Cargo Pod", "Jump Drive"]);
    await page.screenshot({ path: "artifacts/adaptive-loadout-hunter-attachments.png", fullPage: false });
    await page.locator("#loadoutCategoryWeapons").click();

    const shellFits = await page.locator(".adaptive-loadout-shell").evaluate(shell => {
      const frame = shell.getBoundingClientRect();
      return frame.top >= 0 && frame.bottom <= window.innerHeight + 1;
    });
    expect(shellFits).toBe(true);

    await page.screenshot({ path: "artifacts/adaptive-loadout-hunter.png", fullPage: false });
  });

  test("keeps damaged-hull service visible and repairs from the loadout screen", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      ownedShips = ["falcon"];
      credits = 50000;
      shipLoadouts.falcon = {
        guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)],
        attachments: []
      };
      shipConditions.falcon = { hull: 480, shield: 180 };
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    const service = page.locator("#overviewRepairPanel .prestige-repair-strip");
    const repair = service.getByRole("button", { name: "Repair Hull" });
    const expectedHullMax = await page.evaluate(() => hullMax);
    await expect(service).toBeVisible();
    await expect(service).toContainText(`480 / ${expectedHullMax} hull`);
    await expect(repair).toBeVisible();
    await expect(repair).toBeEnabled();

    const serviceFits = await service.evaluate(card => {
      const cardRect = card.getBoundingClientRect();
      const panelRect = card.closest(".active-vessel-panel").getBoundingClientRect();
      return cardRect.left >= panelRect.left - 1
        && cardRect.right <= panelRect.right + 1
        && cardRect.top >= panelRect.top - 1
        && cardRect.bottom <= panelRect.bottom + 1
        && cardRect.bottom <= window.innerHeight + 1;
    });
    expect(serviceFits).toBe(true);

    await page.screenshot({ path: "artifacts/adaptive-loadout-repair.png", fullPage: false });
    await repair.click();
    await expect(page.locator("#overviewRepairPanel .loadout-repair-ready")).toHaveText(/Hull fully repaired/i);
    await expect.poll(() => page.evaluate(() => ({ hull, savedHull: shipConditions.falcon.hull }))).toEqual({ hull: expectedHullMax, savedHull: expectedHullMax });
  });

  test("fits the Moth's 15 weapon and 15 attachment slots without unsupported cells", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "monolith";
      selectedHangarShipId = "monolith";
      ownedShips = ["monolith"];
      const weaponKeys = ["pulseLaser", "ionBlaster", "heavyLance", "repeater", "meltCannon", "pulseLaser", "ionBlaster", "heavyLance", "repeater", "meltCannon", "pulseLaser", "ionBlaster"];
      shipLoadouts.monolith = {
        guns: weaponKeys.map((key, index) => makeLeveledLoadoutEntry(key, index % 3 === 0 ? "advanced" : "standard", (index % 5) + 1)),
        attachments: Array.from({ length: 15 }, (_unused, index) => makeLeveledLoadoutEntry(index % 2 ? "jumpDrive" : "cargoPod", "standard", (index % 5) + 1))
      };
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await expect(page.locator("#installedGuns .loadout-grid-slot")).toHaveCount(15);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(12);
    await expect(page.locator("#installedGuns .loadout-grid-slot.empty")).toHaveCount(3);
    await expect(page.locator("#installedGuns .loadout-grid-slot.locked")).toHaveCount(0);
    await expect(page.locator("#installedGuns")).toHaveClass(/dense-slots/);
    await expect(page.locator("#loadoutCategoryWeapons")).toHaveText("Weapons 12/15");
    await expect(page.locator("#loadoutFittedSummary")).toHaveText("27 / 30 slots fitted");

    await page.locator("#installedGuns .loadout-grid-slot").nth(8).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot").nth(8)).toHaveClass(/selected/);
    await expect(page.locator("#loadoutSelectedSlotBar")).toContainText("Weapon 09");

    const allSlotsFit = await page.locator("#installedGuns").evaluate(grid => {
      const frame = grid.getBoundingClientRect();
      return [...grid.children].every(slot => {
        const rect = slot.getBoundingClientRect();
        return rect.left >= frame.left - 1 && rect.right <= frame.right + 1 && rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1;
      });
    });
    expect(allSlotsFit).toBe(true);

    await page.locator("#loadoutCategoryAttachments").click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot")).toHaveCount(15);
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(15);
    await expect(page.locator("#installedAttachments")).toHaveClass(/dense-slots/);
    await page.locator("#loadoutCategoryWeapons").click();
    await page.locator("#installedGuns .loadout-grid-slot").nth(8).click();
    await page.mouse.move(20, 20);

    await page.screenshot({ path: "artifacts/adaptive-loadout-moth-15-slots.png", fullPage: false });
  });

  test("selects, explicitly replaces and unequips gear in a fully fitted slot", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      ownedShips = ["falcon"];
      playerProgress.combatXp = 100000;
      ownedGuns.heavyLance = 1;
      shipLoadouts.falcon = {
        guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1), makeLeveledLoadoutEntry("ionBlaster", "advanced", 3)],
        attachments: [makeLeveledLoadoutEntry("cargoPod", "standard", 1), makeLeveledLoadoutEntry("jumpDrive", "refined", 2)]
      };
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    const heavyLanceCard = page.locator("#gunInventory .loadout-vault-row").filter({ hasText: "Heavy Lance" });
    await heavyLanceCard.getByRole("button", { name: "Replace" }).click();
    await expect.poll(() => page.evaluate(() => getEquipmentKey(shipLoadouts.falcon.guns[1]))).toBe("heavyLance");
    await expect(page.locator("#installedGuns .loadout-grid-slot").nth(1)).toContainText("Heavy Lance");
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Heavy Lance");
    await page.screenshot({ path: "artifacts/adaptive-loadout-direct-equip.png", fullPage: false });

    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip", exact: true }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => shipLoadouts.falcon.guns.some(entry => getEquipmentKey(entry) === "heavyLance"))).toBe(false);
  });

  test("keeps a purchased weapon through selection, equip, unequip and reload", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      ownedShips = ["falcon"];
      playerProgress.combatXp = 100000;
      credits = 50000;
      ownedGuns.ionBlaster = 0;
      shipLoadouts.falcon = {
        guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)],
        attachments: []
      };
      applyShipStats(false);
      buyGun("ionBlaster");
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
      selectEquippedLoadoutVaultItem("guns", 1);
    })()`));

    const ionCard = page.locator("#gunInventory .loadout-vault-row").filter({ hasText: "Ion Blaster" });
    await expect(ionCard).toHaveCount(1);
    await expect(ionCard).toContainText("x1 stored");
    await expect.poll(() => page.evaluate(() => ownedGuns.ionBlaster)).toBe(1);
    await page.screenshot({ path: "artifacts/adaptive-loadout-vault-selection.png", fullPage: false });
    await ionCard.getByRole("button", { name: "Equip" }).click();
    await expect.poll(() => page.evaluate(() => ({ stored: ownedGuns.ionBlaster, fitted: getEquipmentKey(shipLoadouts.falcon.guns[1]) }))).toEqual({ stored: 0, fitted: "ionBlaster" });

    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip", exact: true }).click();
    await expect.poll(() => page.evaluate(() => ({ stored: ownedGuns.ionBlaster, fitted: shipLoadouts.falcon.guns.some(entry => getEquipmentKey(entry) === "ionBlaster") }))).toEqual({ stored: 1, fitted: false });
    await page.reload();
    await waitForGame(page);
    await page.evaluate(() => window.eval(`(() => {
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
      setLoadoutSlotCategory("guns");
    })()`));
    await expect(page.locator("#gunInventory .loadout-vault-row").filter({ hasText: "Ion Blaster" })).toContainText("x1 stored");
  });

  test("uses the compact rack and library controls for an intermediate ship", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      SHIPS.zeusExplorer.gunSlots = 8;
      SHIPS.zeusExplorer.attachmentSlots = 6;
      currentShipId = "zeusExplorer";
      selectedHangarShipId = "zeusExplorer";
      ownedShips = ["zeusExplorer"];
      playerProgress.combatXp = 100000;
      const weaponKeys = ["pulseLaser", "ionBlaster", "heavyLance", "repeater", "meltCannon", "voidRail"];
      shipLoadouts.zeusExplorer = {
        guns: weaponKeys.map((key, index) => makeLeveledLoadoutEntry(key, index % 2 ? "advanced" : "standard", (index % 4) + 1)),
        attachments: Array.from({ length: 4 }, (_unused, index) => makeLeveledLoadoutEntry(index % 2 ? "jumpDrive" : "cargoPod", "standard", index + 1))
      };
      ownedGuns = { ...ownedGuns, pulseLaser: 2, ionBlaster: 2, heavyLance: 2, repeater: 2, meltCannon: 2, voidRail: 2 };
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await expect(page.locator("#installedGuns")).toHaveClass(/compact-slots/);
    await expect(page.locator("#installedGuns .loadout-grid-slot")).toHaveCount(8);
    await expect(page.locator("#hangarOverviewSection")).toHaveClass(/loadout-density-compact/);
    await expect(page.locator(".loadout-vault-controls")).toHaveClass(/is-useful/);
    await expect(page.locator("#gunInventory .loadout-vault-row")).toHaveCount(6);
    const compactGeometry = await page.locator("#installedGuns .loadout-grid-slot.filled").first().evaluate(slot => {
      const slotRect = slot.getBoundingClientRect();
      const artRect = slot.querySelector(".quality-fx__item").getBoundingClientRect();
      return artRect.left >= slotRect.left - 1
        && artRect.right <= slotRect.right + 1
        && artRect.top >= slotRect.top - 1
        && artRect.bottom <= slotRect.bottom + 1;
    });
    expect(compactGeometry).toBe(true);
    await page.screenshot({ path: "artifacts/adaptive-loadout-destroyer.png", fullPage: false });
  });

  test("filters a thirty-variation weapon library without moving the page", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openAdaptiveLoadout(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "monolith";
      selectedHangarShipId = "monolith";
      ownedShips = ["monolith"];
      playerProgress.combatXp = 100000;
      const weaponKeys = ["pulseLaser", "ionBlaster", "heavyLance", "repeater", "meltCannon", "ripperGun", "voidRail"];
      shipLoadouts.monolith = {
        guns: Array.from({ length: 12 }, (_unused, index) => makeLeveledLoadoutEntry(weaponKeys[index % weaponKeys.length], "standard", (index % 5) + 1)),
        attachments: Array.from({ length: 10 }, (_unused, index) => makeLeveledLoadoutEntry(index % 2 ? "jumpDrive" : "cargoPod", "standard", (index % 5) + 1))
      };
      inventoryItems = Array.from({ length: 30 }, (_unused, index) => ({
        id: "stress-weapon-" + index,
        key: weaponKeys[index % weaponKeys.length],
        quality: "standard",
        level: Math.floor(index / weaponKeys.length) + 1
      }));
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await expect(page.locator("#gunInventory .loadout-vault-row")).toHaveCount(30);
    await expect(page.locator("#loadoutVaultResults")).toHaveText("30 weapon variations");
    await expect(page.locator(".loadout-vault-controls")).toHaveClass(/is-useful/);
    await page.locator("#loadoutVaultSearch").fill("Void Rail");
    const filteredCount = await page.locator("#gunInventory .loadout-vault-row").count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(30);
    await expect(page.locator("#loadoutVaultResults")).toContainText("weapon variation");

    const screenFits = await page.locator("#hangarScreen").evaluate(screen => {
      const rect = screen.getBoundingClientRect();
      return rect.top >= -1 && rect.bottom <= window.innerHeight + 1 && rect.left >= -1 && rect.right <= window.innerWidth + 1;
    });
    expect(screenFits).toBe(true);
    await page.locator("#loadoutVaultSearch").fill("");
    await page.screenshot({ path: "artifacts/adaptive-loadout-moth-library.png", fullPage: false });
  });
});
