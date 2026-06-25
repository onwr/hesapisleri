/**
 * Satış tahsilatı kasa seçimi görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   APP_BASE_URL=http://localhost:3000 APP_EMAIL=... APP_PASSWORD=... npx tsx scripts/capture-sales-collection-screenshots.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.APP_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const password = process.env.APP_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const outputDir =
  process.env.SALES_COLLECTION_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "sales-collection-visual");

const shots = [
  {
    name: "sales-new-collection-account-1440",
    path: "/sales/new",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "sales-new-collection-account-390",
    path: "/sales/new",
    viewport: { width: 390, height: 844 },
  },
];

async function main() {
  if (!email || !password) {
    throw new Error("APP_EMAIL ve APP_PASSWORD ortam değişkenleri gerekli.");
  }

  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30000,
  });

  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${baseUrl}${shot.path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    const filePath = path.join(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`Saved ${filePath}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
