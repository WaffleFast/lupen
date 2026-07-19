const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

async function openFleet(page, setup) {
  await page.goto("/");
  await waitForGame(page);
  await page.evaluate(setup);
}

test.describe("Hangar Fleet roster", () => {
  test("gives a single owned vessel a focused management workspace", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openFleet(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      selectedFleetShipId = "falcon";
      ownedShips = ["falcon"];
      ensureShipCondition("falcon");
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("owned");
    })()`));

    await expect(page.locator("#hangarOwnedSection")).toHaveClass(/active/);
    await expect(page.locator("#hangarOwnedSection .fleet-title-row")).toContainText("Select an owned vessel");
    await expect(page.locator("#fleetCountText")).toHaveText("1");
    await expect(page.locator("#fleetCountLabel")).toHaveText("vessel owned");
    await expect(page.locator("#ownedShipsList .fleet-roster-card")).toHaveCount(1);
    await expect(page.locator("#ownedShipsList .fleet-roster-card")).toHaveClass(/active/);
    await expect(page.locator("#ownedShipsList .fleet-roster-card")).toHaveClass(/selected/);
    await expect(page.locator("#fleetDetailPanel .fleet-selected-identity")).toContainText("Pioneer Hunter");
    await expect(page.locator("#fleetDetailPanel .fleet-selected-status")).toContainText("Active");
    await expect(page.locator("#fleetDetailPanel .fleet-selected-stats .fleet-stat-chip")).toHaveCount(6);
    await expect(page.locator("#fleetDetailPanel .fleet-repair-action")).toBeDisabled();
    await expect(page.locator("#fleetDetailPanel .fleet-management-primary")).toHaveText("Open Loadout");

    const presentationGeometry = await page.locator("#fleetDetailPanel .fleet-selected-presentation").evaluate(frame => {
      const image = frame.querySelector("img");
      if (!image) return { fits: false };
      const outer = frame.getBoundingClientRect();
      const art = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return {
        fits: art.left >= outer.left - 1 && art.right <= outer.right + 1 && art.top >= outer.top - 1 && art.bottom <= outer.bottom + 1,
        outer: { left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom, width: outer.width, height: outer.height },
        art: { left: art.left, right: art.right, top: art.top, bottom: art.bottom, width: art.width, height: art.height },
        style: { width: style.width, height: style.height, maxWidth: style.maxWidth, maxHeight: style.maxHeight, transform: style.transform }
      };
    });
    expect(presentationGeometry.fits).toBe(true);

    await page.screenshot({ path: "artifacts/fleet-roster-single.png", fullPage: false });
    await page.locator("#fleetDetailPanel .fleet-management-primary").click();
    await expect(page.locator("#hangarOverviewSection")).toHaveClass(/active/);
  });

  test("selects and activates vessels from a four-ship roster", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await openFleet(page, () => window.eval(`(() => {
      localStorage.clear();
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      selectedFleetShipId = "falcon";
      ownedShips = ["falcon", "zeusExplorer", "bison", "monolith"];
      ownedShips.forEach(ensureShipCondition);
      applyShipStats(false);
      showScreen("gameScreen");
      openHangar();
      showHangarSection("owned");
    })()`));

    await expect(page.locator("#ownedShipsList .fleet-roster-card")).toHaveCount(4);
    await expect(page.locator("#fleetCountText")).toHaveText("4");
    await expect(page.locator("#fleetCountLabel")).toHaveText("vessels owned");

    const rosterFits = await page.locator("#ownedShipsList").evaluate(list => {
      const frame = list.getBoundingClientRect();
      return [...list.children].every(card => {
        const rect = card.getBoundingClientRect();
        return rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1;
      });
    });
    expect(rosterFits).toBe(true);

    const mothCard = page.locator("#ownedShipsList .fleet-roster-card[data-ship-id='monolith']");
    await mothCard.click();
    await expect(mothCard).toHaveClass(/selected/);
    await expect(mothCard).not.toHaveClass(/active/);
    await expect(page.locator("#fleetDetailPanel .fleet-selected-identity")).toContainText("Pioneer Moth");
    await expect(page.locator("#fleetDetailPanel .fleet-selected-status")).toContainText("Owned");
    await expect(page.locator("#fleetDetailPanel .fleet-management-primary")).toHaveText("Set Active");

    await page.locator("#fleetDetailPanel .fleet-management-primary").click();
    await expect(page.locator("#ownedShipsList .fleet-roster-card[data-ship-id='monolith']")).toHaveClass(/active/);
    await expect(page.locator("#fleetDetailPanel .fleet-selected-status")).toContainText("Active");
    await expect(page.locator("#fleetDetailPanel .fleet-management-primary")).toHaveText("Open Loadout");
    await expect.poll(() => page.evaluate(() => currentShipId)).toBe("monolith");

    await page.screenshot({ path: "artifacts/fleet-roster-four-ships.png", fullPage: false });
  });
});
