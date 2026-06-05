const { defineConfig, devices } = require("@playwright/test");

const host = process.env.LUPEN_E2E_HOST || "127.0.0.1";
const port = process.env.LUPEN_E2E_PORT || "4173";
const localBaseUrl = `http://${host}:${port}`;
const externalBaseUrl = process.env.LUPEN_BASE_URL;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testIgnore: process.env.LUPEN_INCLUDE_LIVE_STAGING === "true" ? [] : ["**/*.live.spec.js"],
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  outputDir: "artifacts/playwright-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]
  ],
  use: {
    baseURL: externalBaseUrl || localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
