import { defineConfig } from "@playwright/test";
import { existsSync, globSync } from "node:fs";

const systemChromium = [...globSync("/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome")].find(existsSync);

if (process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error("Write-capable tests cannot use PLAYWRIGHT_BASE_URL. Run pnpm test:e2e to start an isolated temporary instance.");
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/isolated-setup.mjs",
  workers: 1,
  timeout: 60000,
  outputDir: "generated-artifacts/playwright",
  reporter: "list",
  use: {
    actionTimeout: 10000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: systemChromium ? { executablePath: systemChromium, args: ["--no-sandbox"] } : undefined,
  },
});
