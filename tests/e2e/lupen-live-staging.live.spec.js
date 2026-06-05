const { test, expect } = require("@playwright/test");

const email = process.env.LUPEN_TEST_EMAIL || "";
const password = process.env.LUPEN_TEST_PASSWORD || "";

test.describe("Lupen live multiplayer staging", () => {
  test.skip(!email || !password, "Set LUPEN_TEST_EMAIL and LUPEN_TEST_PASSWORD to run the opt-in live staging check.");

  test("authenticated staging reports verified auth and exposes XP UI", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^login$/i }).click();
    await page.locator("#loginUser").fill(email);
    await page.locator("#loginPassword").fill(password);
    await page.locator("#loginScreen button", { hasText: "Login" }).click();

    await expect(page.locator("#gameScreen")).toHaveClass(/active/, { timeout: 20000 });

    await page.goto("/?mp=staging&debug=mp");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging|MP/i, { timeout: 30000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/auth/i, { timeout: 30000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/verified/i, { timeout: 30000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/trusted id present/i, { timeout: 30000 });

    const combatXp = await page.evaluate(() => {
      if (typeof window.getCombatLevelInfo !== "function") return null;
      return window.getCombatLevelInfo().total;
    });
    expect(combatXp).not.toBeNull();
    await expect(page.locator("#hudProgressStrip")).toContainText(/XP|Level/i, { timeout: 10000 });
  });
});
