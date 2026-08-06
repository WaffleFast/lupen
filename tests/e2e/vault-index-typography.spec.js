const { test, expect } = require("@playwright/test");

test("Station Vault index headers retain clearance at the compact viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1228, height: 731 });
  await page.goto("/");
  await page.waitForFunction(() => typeof window.openHangar === "function", null, { timeout: 15000 });

  await page.evaluate(() => window.eval(`
    (() => {
      localStorage.clear();
      currentShipId = STARTER_SHIP_ID;
      selectedHangarShipId = STARTER_SHIP_ID;
      selectedFleetShipId = STARTER_SHIP_ID;
      ownedShips = [STARTER_SHIP_ID];
      ownedAttachments = { cargoPod: 1 };
      ownedGuns = { ...ownedGuns, pulseLaser: 2 };
      inventoryItems = [{ id: "vault-core", key: "lupenCore", quality: "godlike" }];
      shipLoadouts[STARTER_SHIP_ID] = normalizeShipLoadout({ attachments: [], guns: [] }, STARTER_SHIP_ID);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("vault");
    })()
  `));

  const headers = page.locator("#vaultFilterBar .vault-filter-btn > span strong");
  await expect(headers).toHaveCount(4);
  await expect(page.locator("#vaultFilterAttachments")).toBeVisible();

  const measurements = await page.locator("#vaultFilterBar .vault-filter-btn").evaluateAll(buttons => buttons.map(button => {
    const header = button.querySelector("strong");
    const count = button.querySelector(":scope > b");
    const headerRect = header.getBoundingClientRect();
    const countRect = count.getBoundingClientRect();
    return {
      label: header.textContent.trim(),
      fontSize: getComputedStyle(header).fontSize,
      clearance: Math.round(countRect.left - headerRect.right),
      textFits: header.scrollWidth <= header.clientWidth
    };
  }));

  for (const item of measurements) {
    expect(item.fontSize, item.label).toBe("11px");
    expect(item.clearance, item.label).toBeGreaterThanOrEqual(8);
    expect(item.textFits, item.label).toBe(true);
  }

  await page.screenshot({ path: "artifacts/vault-index-type-1228x731.png", fullPage: false });
});
