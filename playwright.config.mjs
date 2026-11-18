import {defineConfig, devices} from '@playwright/test';

const production = process.env.STOA_DOCS_PLAYWRIGHT_TARGET === 'production';
const localURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: production ? 'https://docs.gostoa.dev' : localURL,
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['Pixel 7']}},
  ],
  webServer: production ? undefined : {
    command: 'npm run serve -- --host 127.0.0.1 --port 4173 --no-open',
    url: localURL,
  },
});
