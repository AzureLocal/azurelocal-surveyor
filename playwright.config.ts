import { defineConfig } from '@playwright/test'

const publishedUrl = process.env.PLAYWRIGHT_BASE_URL
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.pw.ts',
  workers: 1,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: publishedUrl ?? 'http://127.0.0.1:4173/azurelocal-surveyor/',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: publishedUrl ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/azurelocal-surveyor/',
    reuseExistingServer: false,
  },
})
