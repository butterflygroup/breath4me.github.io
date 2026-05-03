// CommonJS config so CI and older Node (no ESM-playwright-loading quirk) work reliably.
/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx serve . -p 4173 --no-port-switching --no-request-logging',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
};
