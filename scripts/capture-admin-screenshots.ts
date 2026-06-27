/**
 * Admin panel görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   ADMIN_BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/capture-admin-screenshots.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.ADMIN_BASE_URL ?? "http://localhost:3000";
const email = process.env.ADMIN_EMAIL ?? "";
const password = process.env.ADMIN_PASSWORD ?? "";
const outputDir =
  process.env.ADMIN_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "admin-visual");

type Shot = {
  name: string;
  path: string;
  viewport: { width: number; height: number };
};

const shots: Shot[] = [
  {
    name: "companies-1440",
    path: "/admin/companies",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "subscriptions-1440",
    path: "/admin/subscriptions",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "subscriptions-390",
    path: "/admin/subscriptions",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "companies-390",
    path: "/admin/companies",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "partner-settings-1440",
    path: "/admin/partners/settings",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "partner-settings-390",
    path: "/admin/partners/settings",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "dashboard-1440",
    path: "/admin?range=30d",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "dashboard-390",
    path: "/admin?range=30d",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "dashboard-7d-1440",
    path: "/admin?range=7d",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "payments-1440",
    path: "/admin/payments",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "membership-campaigns-1440",
    path: "/admin/membership-campaigns",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "membership-campaigns-390",
    path: "/admin/membership-campaigns",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "membership-coupons-1440",
    path: "/admin/membership-coupons",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "membership-coupons-390",
    path: "/admin/membership-coupons",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "campaign-new-1440",
    path: "/admin/membership-campaigns/new",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "campaign-detail-1440",
    path: "/admin/membership-campaigns",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "campaign-detail-390",
    path: "/admin/membership-campaigns",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "coupon-new-1440",
    path: "/admin/membership-coupons/new",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "coupon-detail-1440",
    path: "/admin/membership-coupons",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "billing-coupon-1440",
    path: "/settings/billing",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "billing-coupon-390",
    path: "/settings/billing",
    viewport: { width: 390, height: 844 },
  },
];

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
      "ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenleri gerekli (Super Admin hesabı)."
    );
    process.exit(1);
  }

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 30000 }).catch(() => {
    // login redirect farklı olabilir
  });

  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const file = path.join(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${file}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/admin/subscriptions`, { waitUntil: "networkidle" });
  const detailHref = await page
    .locator('a[href^="/admin/subscriptions/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);

  if (detailHref) {
    for (const [name, viewport] of [
      ["subscription-detail-1440", { width: 1440, height: 900 }],
      ["subscription-detail-390", { width: 390, height: 844 }],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const file = path.join(outputDir, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${file}`);
    }

    for (const [tab, namePrefix] of [
      ["pricing", "subscription-pricing"],
      ["history", "subscription-history"],
    ] as const) {
      for (const [suffix, viewport] of [
        ["-1440", { width: 1440, height: 900 }],
        ["-390", { width: 390, height: 844 }],
      ] as const) {
        await page.setViewportSize(viewport);
        await page.goto(`${baseUrl}${detailHref}?tab=${tab}`, {
          waitUntil: "networkidle",
        });
        await page.waitForTimeout(500);
        const file = path.join(outputDir, `${namePrefix}${suffix}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`✓ ${file}`);
      }
    }
  }

  await browser.close();
  console.log(`Screenshotlar: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
