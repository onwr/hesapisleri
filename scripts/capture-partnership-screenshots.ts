/**
 * Ortaklık programı görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   APP_BASE_URL=http://localhost:3000 APP_EMAIL=... APP_PASSWORD=... npx tsx scripts/capture-partnership-screenshots.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.APP_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const password = process.env.APP_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const outputDir =
  process.env.PARTNERSHIP_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "partnership-visual");

const shots = [
  {
    name: "dashboard-sidebar-partnership-1440",
    path: "/dashboard",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "partnership-apply-1440",
    path: "/partnership/apply",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "partnership-apply-390",
    path: "/partnership/apply",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "partnership-dashboard-1440",
    path: "/partnership/dashboard",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "partnership-status-1440",
    path: "/partnership/status",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "admin-partners-1440",
    path: "/admin/partners",
    viewport: { width: 1440, height: 900 },
  },
] as const;

async function login(page: import("playwright").Page) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|admin|pos|partnership)/, {
    timeout: 30000,
  });
}

async function main() {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "playwright paketi bulunamadı. Kurulum: npm i -D playwright && npx playwright install chromium"
    );
    process.exit(1);
  }

  if (!email || !password) {
    console.error(
      "APP_EMAIL ve APP_PASSWORD (veya ADMIN_EMAIL / ADMIN_PASSWORD) gerekli."
    );
    process.exit(1);
  }

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);

  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const file = path.join(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${file}`);
  }

  await browser.close();
  console.log(`Screenshotlar: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
