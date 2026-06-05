const { test, expect } = require("@playwright/test");

const email = process.env.LUPEN_TEST_EMAIL || "";
const password = process.env.LUPEN_TEST_PASSWORD || "";

test.describe("Lupen live multiplayer staging", () => {
  test.skip(!email || !password, "Set LUPEN_TEST_EMAIL and LUPEN_TEST_PASSWORD to run the opt-in live staging check.");

  test("authenticated staging reports verified auth and exposes XP UI", async ({ page }) => {
    test.setTimeout(90000);

    await test.step("load live landing screen", async () => {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page.locator("#startScreen")).toBeVisible({ timeout: 30000 });
      await expect(page.locator("#startScreen").getByRole("button", { name: /^login$/i })).toBeVisible({ timeout: 10000 });
    });

    await test.step("log in with supplied Supabase credentials", async () => {
      await page.locator("#startScreen").getByRole("button", { name: /^login$/i }).click();
      await expect(page.locator("#loginScreen")).toHaveClass(/active/, { timeout: 10000 });
      await page.locator("#loginUser").fill(email);
      await page.locator("#loginPassword").fill(password);
      await page.locator("#loginScreen button", { hasText: "Login" }).click();
      await expect(page.locator("#gameScreen")).toHaveClass(/active/, { timeout: 30000 });
    });

    await test.step("connect to multiplayer staging with verified auth", async () => {
      await page.goto("/?mp=staging&debug=mp", { waitUntil: "domcontentloaded", timeout: 60000 });
      await expect(page.locator("#startScreen, #gameScreen").first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging|MP/i, { timeout: 30000 });
      await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/auth/i, { timeout: 30000 });
      await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/verified/i, { timeout: 30000 });
      await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/trusted id present/i, { timeout: 30000 });
    });

    await test.step("confirm Pilot/HUD XP UI is readable", async () => {
      const combatXp = await page.evaluate(() => {
        if (typeof window.getCombatLevelInfo !== "function") return null;
        return window.getCombatLevelInfo().total;
      });
      expect(combatXp).not.toBeNull();
      await expect(page.locator("#hudProgressStrip")).toContainText(/XP|Level/i, { timeout: 10000 });
    });
  });
});
