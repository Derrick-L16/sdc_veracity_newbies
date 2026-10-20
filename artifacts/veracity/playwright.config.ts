import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const systemBrowser = '/repl/tools/bin/chromium'
export default defineConfig({
  testDir: './tests',
  outputDir: '../../generated-artifacts/playwright',
  reporter: 'list',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80',
    headless: true,
    actionTimeout: 15_000,
    launchOptions: existsSync(systemBrowser) ? { executablePath: systemBrowser, args: ['--no-sandbox'] } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
