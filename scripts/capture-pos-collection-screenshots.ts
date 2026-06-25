/**
 * POS tahsilat hesabı seçimi görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   APP_BASE_URL=http://localhost:3000 APP_EMAIL=... APP_PASSWORD=... npx tsx scripts/capture-pos-collection-screenshots.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.APP_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const password = process.env.APP_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const outputDir =
  process.env.POS_COLLECTION_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "pos-collection-visual");

const shots = [
  {
    name: "pos-payment-modal-single-1440",
    path: "/pos",
    viewport: { width: 1440, height: 900 },
    openPayment: true,
    splitMode: false,
  },
  {
    name: "pos-payment-modal-split-1440",
    path: "/pos",
    viewport: { width: 1440, height: 900 },
    openPayment: true,
    splitMode: true,
  },
  {
    name: "pos-payment-modal-390",
    path: "/pos",
    viewport: { width: 390, height: 844 },
    openPayment: true,
    splitMode: false,
  },
];

async function login(page: import("playwright").Page) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30000,
  });
}

async function addFirstProductToCart(page: import("playwright").Page) {
  const addButton = page.getByRole("button", { name: "Ekle" }).first();
  await addButton.waitFor({ state: "visible", timeout: 15000 });
  await addButton.click();
  await page.waitForTimeout(400);
}

async function openPaymentModal(page: import("playwright").Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < 1280) {
    const mobileCart = page.getByRole("button", { name: /sepet/i });
    await mobileCart.first().click({ timeout: 10000 });
    await page.waitForTimeout(400);
  }

  const checkoutButton = page.getByRole("button", {
    name: /satışı tamamla/i,
  });
  await checkoutButton.first().click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="pos-payment-modal"]', {
    timeout: 10000,
  });
}

async function main() {
  if (!email || !password) {
    throw new Error("APP_EMAIL ve APP_PASSWORD ortam değişkenleri gerekli.");
  }

  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);

  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${baseUrl}${shot.path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await addFirstProductToCart(page);

    if (shot.openPayment) {
      await openPaymentModal(page);

      if (shot.splitMode) {
        const splitToggle = page.getByRole("button", {
          name: /parçalı ödeme/i,
        });
        if (await splitToggle.count()) {
          await splitToggle.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await page.waitForTimeout(800);
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
