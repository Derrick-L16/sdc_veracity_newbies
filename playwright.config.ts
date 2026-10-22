import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const storePath = "/nix/store";
const browserStores = existsSync(storePath)
  ? readdirSync(storePath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.includes("playwright-browsers"))
      .map((entry) => path.join(storePath, entry.name))
  : [];
const systemChromium = browserStores
  .flatMap((browserStore) =>
    readdirSync(browserStore, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
      .map((entry) => path.join(browserStore, entry.name, "chrome-linux", "chrome")),
  )
  .find(existsSync);

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
