const { test, expect } = require("@playwright/test");

const FIXED_NOW = Date.UTC(2026, 7, 5, 12, 0, 0);

test.use({
  viewport: { width: 1366, height: 768 },
  colorScheme: "dark",
  reducedMotion: "reduce"
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(fixedNow => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixedNow]));
      }

      static now() {
        return fixedNow;
      }
    }

    let randomState = 0x5f3759df;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x100000000;
    };
    window.Date = FixedDate;
  }, FIXED_NOW);

  await page.goto("/");
  await page.waitForFunction(() =>
    typeof window.openJourney === "function" &&
    typeof window.openMarketplace === "function" &&
    typeof window.openStore === "function" &&
    typeof window.openHangar === "function"
  );
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify({ username: "North" }));
    tutorialState = { active: false, completed: true, stepIndex: 0 };
    currentNode = "Asteron Prime";
    lastPlanetNode = "Asteron Prime";
    credits = 48591;
    currentShipId = STARTER_SHIP_ID;
    selectedHangarShipId = STARTER_SHIP_ID;
    selectedFleetShipId = STARTER_SHIP_ID;
    selectedShipyardShipId = STARTER_SHIP_ID;
    ownedShips = [STARTER_SHIP_ID, "bison"];
    ownedAttachments = { ...ownedAttachments, cargoPod: 1, jumpDrive: 1 };
    ownedGuns = { ...ownedGuns, pulseLaser: 1 };
    shipLoadouts = {
      ...shipLoadouts,
      [STARTER_SHIP_ID]: {
        attachments: [{ key: "cargoPod", quality: "standard", level: 1 }],
        guns: [
          { key: "pulseLaser", quality: "refined", level: 2 },
          { key: "pulseLaser", quality: "refined", level: 2 }
        ]
      }
    };
    playerProgress = normalizePlayerProgress({
      combatXp: 600,
      totals: {
        botsDestroyed: 4,
        bountiesCompleted: 1,
        cargoSold: 150,
        tradesCompleted: 2,
        tradeProfit: 4200
      }
    });
    showScreen("gameScreen");
  });
});

async function prepareScreenshot(page, screenSelector) {
  const screen = page.locator(screenSelector);
  await expect(screen).toHaveClass(/active/);
  await page.evaluate(async selector => {
    const images = Array.from(document.querySelector(selector)?.querySelectorAll("img") || []);
    await Promise.all(images.map(async image => {
      if (!image.complete) await new Promise(resolve => image.addEventListener("load", resolve, { once: true }));
      if (typeof image.decode === "function") await image.decode().catch(() => {});
    }));
  }, screenSelector);
  await page.waitForTimeout(100);
}

async function expectDesktopBaseline(page, name) {
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.002
  });
}

test("Journey desktop baseline", async ({ page }) => {
  await page.evaluate(() => {
    unlockedShipPlans = [];
    missionProgress = createDefaultMissionProgress();
    const finish = id => {
      const mission = MISSIONS_BY_ID[id];
      missionProgress.missions[id] = {
        ...missionProgress.missions[id],
        state: "completed",
        progress: getMissionRequiredAmount(mission),
        completedAt: "2026-08-05T11:00:00.000Z"
      };
    };
    JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "academy").forEach(assignment => finish(assignment.id));
    missionProgress.chapters.academy = {
      ...missionProgress.chapters.academy,
      state: "complete",
      completed: true,
      completedAt: "2026-08-05T11:00:00.000Z",
      rewardClaimed: true,
      rewardClaimedAt: "2026-08-05T11:00:00.000Z",
      rewardId: "academy-completion-v1"
    };
    JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "frontier").forEach(assignment => finish(assignment.id));
    openJourney();
  });
  await prepareScreenshot(page, "#journeyScreen");
  await expectDesktopBaseline(page, "journey-desktop.png");
});

test("Trade Terminal desktop baseline", async ({ page }) => {
  await page.evaluate(() => {
    openMarketplace();
    activeTradeTerminalTab = "market";
    selectedMarketMode = "buy";
    selectedMarketResource = "Iron";
    selectedMarketTargetPlanet = "Nyxara";
    selectedMarketQuantity = 1;
    renderMarketplace();
  });
  await prepareScreenshot(page, "#marketScreen");
  await expectDesktopBaseline(page, "trade-terminal-desktop.png");
});

test("Bounty Board desktop baseline", async ({ page }) => {
  await page.evaluate(() => {
    ensureDailyBounties();
    selectedBountyContractId = dailyBountyContracts[0]?.id || null;
    openBountyBoard();
  });
  await prepareScreenshot(page, "#bountyScreen");
  await expectDesktopBaseline(page, "bounty-board-desktop.png");
});

test("Station Store desktop baseline", async ({ page }) => {
  await page.evaluate(() => {
    selectedStoreItemId = "attachment:cargoPod";
    selectedStoreQuality = "standard";
    openStore();
  });
  await prepareScreenshot(page, "#storeScreen");
  await expectDesktopBaseline(page, "station-store-desktop.png");
});

test("Hangar Loadout desktop baseline", async ({ page }) => {
  await page.evaluate(() => {
    openHangar();
    showHangarSection("overview");
  });
  await prepareScreenshot(page, "#hangarScreen");
  await expectDesktopBaseline(page, "hangar-loadout-desktop.png");
});

test("Pilot Profile desktop baseline", async ({ page }) => {
  await page.evaluate(() => openPilotProfile());
  await prepareScreenshot(page, "#pilotProfileScreen");
  await expectDesktopBaseline(page, "pilot-profile-desktop.png");
});
