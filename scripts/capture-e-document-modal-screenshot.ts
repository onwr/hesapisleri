/**
 * E-Belge bağlantı modalı görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   npx tsx scripts/capture-e-document-modal-screenshot.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.APP_EMAIL ?? "owner@demo.com";
const password = process.env.APP_PASSWORD ?? "123456";
const outputDir =
  process.env.EDOCUMENT_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "e-document-modal");

async function login(page: import("playwright").Page) {
  const response = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Giriş başarısız (${response.status()}): ${body}`);
  }

  await page.goto(`${baseUrl}/settings/integrations`, {
    waitUntil: "domcontentloaded",
  });
}

async function openModal(page: import("playwright").Page) {
  await page.getByRole("button", { name: "Yapılandır" }).first().click();
  await page.getByRole("heading", { name: "E-Belge Bağlantısı" }).waitFor();
}

async function main() {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "playwright paketi bulunamadı. Kurulum: npm i -D playwright && npx playwright install chromium"
    );
  }

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await login(page);
    await openModal(page);
    await page.screenshot({
      path: path.join(outputDir, "01-provider-select.png"),
      fullPage: false,
    });

    await page.selectOption("select", { label: /eFinans/ });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outputDir, "02-efinans-form.png"),
      fullPage: false,
    });

    await page.selectOption("select", { label: /Trendyol E-Faturam/ });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outputDir, "03-trendyol-form.png"),
      fullPage: false,
    });

    console.log(`Screenshot'lar kaydedildi: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
