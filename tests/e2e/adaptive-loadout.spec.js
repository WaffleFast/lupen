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
      shipLoadouts.falcon = {
        guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1), makeLeveledLoadoutEntry("ionBlaster", "advanced", 3)],
        attachments: [makeLeveledLoadoutEntry("cargoPod", "standard", 1), makeLeveledLoadoutEntry("jumpDrive", "refined", 2)]
      };
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await expect(page.locator(".adaptive-loadout-shell")).toBeVisible();
    await expect(page.locator("#installedGuns .loadout-grid-slot")).toHaveCount(2);
    await expect(page.locator("#installedGuns")).toHaveClass(/spacious-slots/);
    await expect(page.locator("#installedGuns .loadout-grid-slot.locked")).toHaveCount(0);
    await expect(page.locator("#loadoutFittedSummary")).toHaveText("4 / 4 slots fitted");
    await expect(page.locator("#overviewShipRole")).toHaveText("Attacker / Interceptor");
    await expect(page.locator("#installedGuns .loadout-slot-copy")).toHaveCount(2);

    const shellFits = await page.locator(".adaptive-loadout-shell").evaluate(shell => {
      const frame = shell.getBoundingClientRect();
      return frame.top >= 0 && frame.bottom <= window.innerHeight + 1;
    });
    expect(shellFits).toBe(true);

    await page.screenshot({ path: "artifacts/adaptive-loadout-hunter.png", fullPage: false });
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

  test("directly replaces and unequips gear in a fully fitted selected slot", async ({ page }) => {
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
      showScreen("gameScreen");
      openHangar();
      showHangarSection("overview");
    })()`));

    await page.locator("#gunInventory .loadout-vault-row").filter({ hasText: "Heavy Lance" }).click();
    await expect.poll(() => page.evaluate(() => getEquipmentKey(shipLoadouts.falcon.guns[1]))).toBe("heavyLance");
    await expect(page.locator("#installedGuns .loadout-grid-slot").nth(1)).toContainText("Heavy Lance");
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Heavy Lance");
    await page.screenshot({ path: "artifacts/adaptive-loadout-direct-equip.png", fullPage: false });

    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip", exact: true }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => shipLoadouts.falcon.guns.some(entry => getEquipmentKey(entry) === "heavyLance"))).toBe(false);
  });
});
