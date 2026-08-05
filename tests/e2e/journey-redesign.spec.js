const { test, expect } = require("@playwright/test");

async function waitForGame(page) {
  await page.goto("/");
  await page.waitForFunction(() => typeof window.openJourney === "function", null, { timeout: 15000 });
}

async function seedFrontier(page, frontierComplete = false) {
  await page.evaluate((completeFrontier) => {
    localStorage.clear();
    tutorialState = { active: false, completed: true, stepIndex: 0 };
    credits = 10000;
    ownedShips = ["falcon", "bison"];
    currentShipId = "falcon";
    unlockedShipPlans = [];
    missionProgress = createDefaultMissionProgress();
    const finish = id => {
      const mission = MISSIONS_BY_ID[id];
      missionProgress.missions[id] = {
        ...missionProgress.missions[id],
        state: "completed",
        progress: getMissionRequiredAmount(mission),
        completedAt: "2026-08-04T08:00:00.000Z"
      };
    };
    JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "academy").forEach(assignment => finish(assignment.id));
    missionProgress.chapters.academy = {
      ...missionProgress.chapters.academy,
      state: "complete",
      completed: true,
      completedAt: "2026-08-04T08:00:00.000Z",
      rewardClaimed: true,
      rewardClaimedAt: "2026-08-04T08:00:00.000Z",
      rewardId: "academy-completion-v1"
    };
    if (completeFrontier) {
      JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "frontier").forEach(assignment => finish(assignment.id));
    }
    showScreen("gameScreen");
    openJourney();
  }, frontierComplete);
  await expect(page.locator("#journeyScreen")).toHaveClass(/active/);
}

test.describe("Journey chapter redesign", () => {
  test("opens current chapter while completed Academy remains reviewable", async ({ page }) => {
    await waitForGame(page);
    await seedFrontier(page);

    const academy = page.locator("[data-journey-chapter-id='academy']");
    const frontier = page.locator("[data-journey-chapter-id='frontier']");
    const chapterTwo = page.locator("[data-journey-chapter-id='next_route']");
    await expect(frontier).toHaveAttribute("aria-pressed", "true");
    await expect(frontier).toContainText("CURRENT");
    await expect(academy).toContainText("COMPLETE");
    await expect(page.locator(".journey-briefing__message")).toHaveText("Complete your remaining Frontier assignments to reveal the next ship plan route.");
    await expect(page.locator(".journey-reward-panel")).toHaveAttribute("data-journey-reward-state", "incomplete");
    await expect(page.locator(".journey-reward-guidance")).toHaveText("Complete 4 remaining assignments to unlock this reward.");
    await expect(chapterTwo).toBeDisabled();
    await expect(chapterTwo.locator(".journey-chapter-route__chevron")).toHaveCount(0);

    await academy.click();
    await expect(academy).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".journey-assignment-head")).toContainText("Academy Assignments");
    await expect(page.locator(".journey-reward-panel")).toContainText("Academy Chapter Reward");
    await expect(page.locator("#journeyBody")).toHaveAttribute("data-journey-active-chapter", "frontier");
    await expect(frontier).toContainText("CURRENT");
  });

  test("assignments complete automatically without individual rewards", async ({ page }) => {
    await waitForGame(page);
    await seedFrontier(page);

    const before = await page.evaluate(() => ({ credits, xp: playerProgress.combatXp }));
    await page.evaluate(() => recordMissionEvent("launch_from_station", { node: "Asteron Prime" }));
    const after = await page.evaluate(() => ({
      credits,
      xp: playerProgress.combatXp,
      state: missionProgress.missions.sector_orientation.state
    }));
    expect(after).toEqual({ ...before, state: "completed" });
    await expect(page.locator("[data-journey-assignment-id='sector_orientation']")).toContainText("Complete");
    await expect(page.locator(".journey-assignment-grid")).not.toContainText("Claim Reward");
    await expect(page.locator(".journey-reward-chip")).toHaveCount(0);
    await expect(page.locator(".journey-assignment-card")).toHaveCount(4);
    await expect(page.locator(".journey-complete-chapter")).toBeDisabled();
  });

  test("keeps compact Academy assignment copy inside its own row", async ({ page }) => {
    await page.setViewportSize({ width: 1223, height: 725 });
    await waitForGame(page);
    await seedFrontier(page);
    await page.locator("[data-journey-chapter-id='academy']").click();

    const rows = await page.locator(".journey-assignment-card").evaluateAll(cards => cards.map(card => {
      const outer = card.getBoundingClientRect();
      const copy = card.querySelector(".journey-objective-copy")?.getBoundingClientRect();
      const title = card.querySelector(".journey-objective-top")?.getBoundingClientRect();
      const description = card.querySelector(".journey-objective-copy p")?.getBoundingClientRect();
      return {
        copyContained: Boolean(copy && copy.top >= outer.top + 1 && copy.bottom <= outer.bottom - 1),
        titleContained: Boolean(title && title.top >= outer.top + 1 && title.bottom <= outer.bottom - 1),
        descriptionContained: Boolean(description && description.top >= outer.top + 1 && description.bottom <= outer.bottom - 1),
        ordered: Boolean(title && description && description.top >= title.bottom - 1)
      };
    }));

    expect(rows).toHaveLength(10);
    expect(rows.every(row => row.copyContained && row.titleContained && row.descriptionContained && row.ordered)).toBe(true);
    await page.screenshot({ path: "artifacts/journey-academy-compact-1223x725.png", fullPage: false });
  });

  test("Frontier reward is granted exactly once and unlocks a plan, not a ship", async ({ page }) => {
    await waitForGame(page);
    await seedFrontier(page, true);

    await expect(page.locator(".journey-reward-panel")).toHaveAttribute("data-journey-reward-state", "ready");
    await expect(page.locator(".journey-briefing__message")).toHaveText("All Frontier assignments are complete. Claim your chapter reward to continue.");
    await expect(page.locator(".journey-reward-guidance")).toHaveText("All assignments complete. Finalise the chapter to receive these rewards.");
    await page.locator(".journey-complete-chapter").click();

    const first = await page.evaluate(() => ({
      credits,
      plans: [...unlockedShipPlans],
      ownsNightshade: ownedShips.includes("nightshadeHawk"),
      ownsAliasHull: ownedShips.includes("zeusExplorer"),
      chapter: missionProgress.chapters.frontier
    }));
    expect(first.credits).toBe(15000);
    expect(first.plans).toContain("nightshadeHawk");
    expect(first.ownsNightshade).toBe(false);
    expect(first.ownsAliasHull).toBe(false);
    expect(first.chapter).toMatchObject({ completed: true, rewardClaimed: true, rewardId: "frontier-completion-v1" });
    await expect(page.locator(".journey-reward-panel")).toHaveAttribute("data-journey-reward-state", "completed");
    await expect(page.locator(".journey-briefing__message")).toHaveText("Frontier is complete. Its rewards and route unlocks have been secured.");
    await expect(page.locator(".journey-complete-chapter")).toHaveCount(0);

    const repeat = await page.evaluate(() => ({ result: completeJourneyChapter("frontier"), credits, plans: [...unlockedShipPlans] }));
    expect(repeat).toEqual({ result: false, credits: 15000, plans: ["nightshadeHawk"] });
  });

  test("save reload and legacy migration preserve claimed chapter state", async ({ page }) => {
    await waitForGame(page);
    await seedFrontier(page, true);
    await page.locator(".journey-complete-chapter").click();

    const restored = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("lupenGameState"));
      credits = 1;
      unlockedShipPlans = [];
      missionProgress = createDefaultMissionProgress();
      applyLoadedGameState(saved);
      return {
        credits,
        plans: [...unlockedShipPlans],
        chapter: missionProgress.chapters.frontier
      };
    });
    expect(restored.credits).toBe(15000);
    expect(restored.plans).toContain("nightshadeHawk");
    expect(restored.chapter).toMatchObject({ completed: true, rewardClaimed: true, rewardId: "frontier-completion-v1" });

    const migrated = await page.evaluate(() => {
      credits = 42000;
      unlockedShipPlans = [];
      const legacy = { chapters: {}, missions: {} };
      CHAPTER_MISSIONS.forEach(mission => {
        legacy.missions[mission.id] = {
          state: "completed",
          progress: getMissionRequiredAmount(mission)
        };
      });
      const normalized = normalizeMissionProgress(legacy);
      return {
        credits,
        plans: [...unlockedShipPlans],
        academy: normalized.chapters.academy,
        frontier: normalized.chapters.frontier
      };
    });
    expect(migrated.credits).toBe(42000);
    expect(migrated.plans).toEqual([]);
    expect(migrated.academy.rewardClaimed).toBe(true);
    expect(migrated.frontier.rewardClaimed).toBe(true);
  });

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1680, height: 1050 }
  ]) {
    test(`fits the redesigned Journey at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForGame(page);
      await seedFrontier(page, true);
      const layout = await page.locator("#journeyScreen").evaluate(screen => ({
        scrollWidth: screen.scrollWidth,
        clientWidth: screen.clientWidth,
        scrollHeight: screen.scrollHeight,
        clientHeight: screen.clientHeight,
        assignmentOverflowY: getComputedStyle(document.querySelector(".journey-assignment-grid")).overflowY,
        lastAssignmentBottom: document.querySelector(".journey-assignment-card:last-child").getBoundingClientRect().bottom,
        assignmentGridBottom: document.querySelector(".journey-assignment-grid").getBoundingClientRect().bottom,
        buttonBottom: document.querySelector(".journey-complete-chapter").getBoundingClientRect().bottom,
        screenBottom: screen.getBoundingClientRect().bottom
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
      expect(layout.assignmentOverflowY).toBe("hidden");
      expect(layout.lastAssignmentBottom).toBeLessThanOrEqual(layout.assignmentGridBottom + 1);
      expect(layout.buttonBottom).toBeLessThanOrEqual(layout.screenBottom);
      await page.screenshot({ path: `artifacts/journey-redesign-${viewport.width}x${viewport.height}.png` });
    });
  }
});
