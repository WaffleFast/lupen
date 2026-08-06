const { test, expect } = require("@playwright/test");

test("space HUD level frame remains compact and complete through refreshes", async ({ page }) => {
  await page.setViewportSize({ width: 1228, height: 731 });
  await page.goto("/");
  await page.waitForFunction(() => typeof window.updateSpaceHUD === "function", null, { timeout: 15000 });

  await page.evaluate(() => window.eval(`
    (() => {
      localStorage.clear();
      if (typeof resetRuntimeForFreshPilot === "function") resetRuntimeForFreshPilot();
      currentShipId = STARTER_SHIP_ID;
      selectedHangarShipId = STARTER_SHIP_ID;
      selectedFleetShipId = STARTER_SHIP_ID;
      ownedShips = [STARTER_SHIP_ID];
      shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, STARTER_SHIP_ID) };
      currentNode = "Asteron Prime";
      lastPlanetNode = "Asteron Prime";
      playerProgress = normalizePlayerProgress({ combatXp: 5500 });
      hull = getShipStats().hull;
      hullMax = hull;
      shield = getShipStats().shield;
      shieldMax = shield;
      jumpCharge = jumpMax;
      showScreen("gameScreen");
      updateHubLocation();
      launchShip();
    })()
  `));
  await expect(page.locator("#spaceScreen")).toHaveClass(/active/);

  const states = await page.evaluate(async () => {
    const sample = label => {
      const badge = document.querySelector("#hudProgressStrip .level-badge");
      const progress = document.getElementById("hudProgressStrip");
      const rect = badge.getBoundingClientRect();
      const progressRect = progress.getBoundingClientRect();
      const styles = getComputedStyle(badge);
      return {
        label,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        topInside: rect.top >= progressRect.top,
        bottomInside: rect.bottom <= progressRect.bottom,
        borderTopWidth: styles.borderTopWidth,
        borderTopStyle: styles.borderTopStyle,
        borderRightWidth: styles.borderRightWidth,
        borderBottomWidth: styles.borderBottomWidth,
        borderLeftWidth: styles.borderLeftWidth,
        clipPath: styles.clipPath
      };
    };
    const results = [sample("initial")];
    for (let index = 0; index < 8; index += 1) {
      updateProgressDisplays();
      await new Promise(resolve => requestAnimationFrame(resolve));
      results.push(sample(`progress-${index}`));
      updateHudDock();
      await new Promise(resolve => requestAnimationFrame(resolve));
      results.push(sample(`dock-${index}`));
      updateSpaceHUD();
      await new Promise(resolve => requestAnimationFrame(resolve));
      results.push(sample(`space-${index}`));
    }
    return results;
  });

  for (const state of states) {
    expect(state, state.label).toMatchObject({
      width: 52,
      height: 44,
      topInside: true,
      bottomInside: true,
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderRightWidth: "1px",
      borderBottomWidth: "1px",
      borderLeftWidth: "1px",
      clipPath: "none"
    });
  }

  await page.screenshot({ path: "artifacts/hud-level-frame-1228x731.png", fullPage: false });
});
