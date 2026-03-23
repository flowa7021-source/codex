// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'desktop-hd',
      use: { viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'desktop-low',
      use: { viewport: { width: 1280, height: 650 } },
    },
    {
      name: 'ultrawide',
      use: { viewport: { width: 2560, height: 900 } },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 375, height: 812 } },
    },
  ],
};

export default config;
