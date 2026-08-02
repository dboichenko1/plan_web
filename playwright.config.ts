import { defineConfig, devices } from '@playwright/test'

// Сквозной сценарий (ТЗ §10). Демо-проект гоняется без Supabase (VITE_DEMO=1);
// полный вход по magic link проверяется вручную на настроенном окружении.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5177',
    ...devices['iPhone 14 Pro'],
    browserName: 'chromium',
  },
  webServer: {
    command: 'VITE_DEMO=1 npx vite --port 5177 --strictPort',
    url: 'http://localhost:5177',
    reuseExistingServer: !process.env.CI,
  },
})
