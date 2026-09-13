import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1, // specs share one local database
  use: { baseURL: 'http://localhost:3100', locale: 'it-IT' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100/link-non-valido',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
