const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

test.describe("Pioneer ship line", () => {
  test("shows the four unlocked plans and keeps future lines encrypted", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForGame(page);

    const state = await page.evaluate(() => window.eval(`(() => {
      resetToNoShipStarterState();
      showScreen("gameScreen");
      openHangar();
      showHangarSection("plans");
      return {
        starterShipId: STARTER_SHIP_ID,
        currentShipId,
        ownedShips: ownedShips.slice(),
        unlockedShipLines: unlockedShipLines.slice(),
        exchangeShips: getExchangeShips().map(ship => ({ id: ship.id, name: ship.name })),
        unlocks: SHIP_LINES.pioneer.shipIds.map(shipId => getShipUnlockStatus(shipId).unlocked)
      };
    })()`));

    expect(state).toEqual({
      starterShipId: "falcon",
      currentShipId: "",
      ownedShips: [],
      unlockedShipLines: ["pioneer"],
      exchangeShips: [
        { id: "falcon", name: "Pioneer Hunter" },
        { id: "zeusExplorer", name: "Pioneer Destroyer" },
        { id: "bison", name: "Pioneer Freighter" },
        { id: "monolith", name: "Pioneer Moth" }
      ],
      unlocks: [true, true, true, true]
    });

    await expect(page.locator("#hangarPlansSection")).toHaveClass(/active/);
    await expect(page.locator("#shipPlansContent")).toContainText("Pioneer Line");
    await expect(page.locator("#shipPlansContent")).toContainText("PLANS UNLOCKED");
    await expect(page.locator(".ship-plan-card")).toHaveCount(4);
    await expect(page.locator(".ship-plan-card[data-ship-id='falcon']")).toContainText("Starter Plan");
    await expect(page.locator(".ship-plan-line.future")).toContainText("NOT DISCOVERED");
    await page.screenshot({ path: "artifacts/pioneer-ship-plans.png", fullPage: false });
  });

  test("claims the Hunter, purchases another Pioneer hull and migrates retired ships", async ({ page }) => {
    await page.goto("/");
    await waitForGame(page);

    const result = await page.evaluate(() => window.eval(`(() => {
      resetToNoShipStarterState();
      buyShip(STARTER_SHIP_ID);
      credits = 50000;
      buyShip("bison");
      const migrated = migrateSavedGame({
        saveVersion: 3,
        currentShipId: "hephaestusTrader",
        selectedHangarShipId: "poseidonAggressor",
        ownedShips: ["hephaestusTrader", "poseidonAggressor", "lupenOrigin"],
        shipLoadouts: {
          hephaestusTrader: { guns: [], attachments: ["cargoPod"] },
          poseidonAggressor: { guns: ["pulseLaser"], attachments: [] }
        },
        shipConditions: {}
      });
      return {
        active: currentShipId,
        owned: ownedShips.slice(),
        credits,
        migratedCurrent: migrated.currentShipId,
        migratedSelected: migrated.selectedHangarShipId,
        migratedOwned: migrated.ownedShips,
        migratedLoadoutIds: Object.keys(migrated.shipLoadouts),
        migratedLines: migrated.unlockedShipLines
      };
    })()`));

    expect(result.active).toBe("falcon");
    expect(result.owned).toEqual(["falcon", "bison"]);
    expect(result.credits).toBe(36000);
    expect(result.migratedCurrent).toBe("bison");
    expect(result.migratedSelected).toBe("zeusExplorer");
    expect(result.migratedOwned).toEqual(["bison", "zeusExplorer", "falcon"]);
    expect(result.migratedLoadoutIds).toEqual(["bison", "zeusExplorer"]);
    expect(result.migratedLines).toContain("pioneer");
  });
});
