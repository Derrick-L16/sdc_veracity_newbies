import { defineConfig } from "@playwright/test";
import { existsSync, globSync } from "node:fs";

const systemChromium = [...globSync("/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome")].find(existsSync);

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  outputDir: "generated-artifacts/playwright",
  reporter: "list",
  use: {
    actionTimeout: 10000,
    baseURL: "http://localhost:80",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: systemChromium ? { executablePath: systemChromium, args: ["--no-sandbox"] } : undefined,
  },
});
