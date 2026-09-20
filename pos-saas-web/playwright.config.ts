import { defineConfig, devices } from "@playwright/test";

const webServer = process.env.PLAYWRIGHT_BASE_URL ? undefined : {
  command: "npm run dev",
  url: "http://localhost:3001",
  reuseExistingServer: true,
  timeout: 120_000,
};

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
