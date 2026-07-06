import { defineConfig } from "@playwright/test";

/**
 * Minimal Playwright kurulumu — yalnız ürün düzenle → geri tuşu regresyon
 * senaryosu için (bkz. e2e/product-edit-back-button.spec.ts). Production
 * URL'ye karşı ÇALIŞTIRILMAZ: baseURL her zaman yerel dev server + test DB'dir.
 */
const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const BASE_URL = `http://localhost:${PORT}`;

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "Playwright E2E, TEST_DATABASE_URL gerektirir (production DB'ye karşı çalıştırılmaz)."
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      DIRECT_URL: process.env.TEST_DATABASE_URL,
      NODE_ENV: "test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
