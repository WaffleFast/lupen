const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

test.describe("Pioneer ship line", () => {
  test("shows the four unlocked plans and keeps future lines encrypted", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
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
    await expect(page.locator(".ship-plan-selector-card[data-line-id='pioneer']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".ship-plan-card")).toHaveCount(4);
    await expect(page.locator(".ship-plan-card[data-ship-id='falcon']")).toContainText("Starter Plan");
    await expect(page.locator(".ship-plan-stat-row")).toHaveCount(0);
    await expect(page.locator(".ship-plan-card[data-ship-id='falcon']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".ship-plan-selection")).toContainText("Pioneer Hunter");
    await expect(page.locator(".ship-plan-selection")).toContainText("Attacker / Interceptor");

    await page.locator(".ship-plan-card[data-ship-id='zeusExplorer']").click();
    await expect(page.locator(".ship-plan-card[data-ship-id='zeusExplorer']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".ship-plan-selection")).toContainText("Pioneer Destroyer");
    await expect(page.locator(".ship-plan-selection button")).toHaveText("View Full Specs");

    const readableDetailCopy = await page.locator(".ship-plan-selection-copy p").evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(readableDetailCopy).toBeGreaterThanOrEqual(13);

    await page.locator(".ship-plan-selector-card[data-line-id='encrypted-future']").click();
    await expect(page.locator(".ship-plan-selector-card[data-line-id='encrypted-future']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".ship-plan-line.future")).toContainText("NOT DISCOVERED");
    await expect(page.locator(".ship-plan-card")).toHaveCount(0);

    await page.locator(".ship-plan-selector-card[data-line-id='pioneer']").click();
    await expect(page.locator(".ship-plan-card")).toHaveCount(4);

    const artworkFits = await page.locator(".ship-plan-card").evaluateAll(cards => cards.every(card => {
      const frame = card.querySelector(".ship-plan-image-wrap")?.getBoundingClientRect();
      const image = card.querySelector("img")?.getBoundingClientRect();
      return frame && image && image.left >= frame.left && image.right <= frame.right && image.top >= frame.top && image.bottom <= frame.bottom;
    }));
    expect(artworkFits).toBe(true);
    await page.screenshot({ path: "artifacts/pioneer-ship-plans.png", fullPage: false });
  });

  test("keeps Vessel Exchange artwork clearly contained above its presentation layer", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 822 });
    await page.goto("/");
    await waitForGame(page);

    await page.evaluate(() => window.eval(`(() => {
      resetToNoShipStarterState();
      buyShip(STARTER_SHIP_ID);
      credits = 50000;
      showScreen("gameScreen");
      openHangar();
      showHangarSection("shipyard");
      selectShipyardShip("monolith");
    })()`));

    await expect(page.locator("#hangarShipyardSection")).toHaveClass(/active/);
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Pioneer Moth");

    const previewLayers = await page.locator("#shipyardDetailPanel .exchange-detail-preview").evaluate(preview => {
      const image = preview.querySelector("img");
      const ring = preview.querySelector(".exchange-hero-ring");
      const imageStyle = image ? getComputedStyle(image) : null;
      const ringStyle = ring ? getComputedStyle(ring) : null;
      const frame = preview.getBoundingClientRect();
      const art = image?.getBoundingClientRect();
      return {
        imageZ: Number(imageStyle?.zIndex || 0),
        ringZ: Number(ringStyle?.zIndex || 0),
        contained: Boolean(art && art.left >= frame.left && art.right <= frame.right && art.top >= frame.top && art.bottom <= frame.bottom)
      };
    });

    expect(previewLayers.contained).toBe(true);
    expect(previewLayers.imageZ).toBeGreaterThan(previewLayers.ringZ);

    const navigationLayout = await page.locator(".hangar-tabs").evaluate(tabs => {
      const buttons = [...tabs.querySelectorAll("button")].map(button => button.getBoundingClientRect());
      return {
        count: buttons.length,
        rowTops: [...new Set(buttons.map(rect => Math.round(rect.top)))],
        vaultVisible: buttons.length === 5 && buttons[4].width > 0 && buttons[4].height > 0
      };
    });
    expect(navigationLayout.count).toBe(5);
    expect(navigationLayout.rowTops).toHaveLength(1);
    expect(navigationLayout.vaultVisible).toBe(true);
    await page.screenshot({ path: "artifacts/pioneer-vessel-exchange.png", fullPage: false });
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
