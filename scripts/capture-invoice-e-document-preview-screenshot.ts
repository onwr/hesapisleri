/**
 * Fatura e-belge önizleme paneli screenshot.
 * Kullanım: npm run dev (ayrı terminal) && npx tsx scripts/capture-invoice-e-document-preview-screenshot.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const email = process.env.APP_EMAIL ?? "owner@demo.com";
const password = process.env.APP_PASSWORD ?? "123456";
const outputDir =
  process.env.EDOCUMENT_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "invoice-e-document-preview");

async function login(page: import("playwright").Page) {
  const response = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Giriş başarısız (${response.status()})`);
  }
}

async function main() {
  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await login(page);
    await page.goto(`${baseUrl}/invoices`, { waitUntil: "domcontentloaded" });
    const firstInvoice = page.locator('a[href^="/invoices/"]').first();
    await firstInvoice.click();
    await page.getByText("E-Belge", { exact: false }).first().waitFor({ timeout: 15000 });
    await page.screenshot({
      path: path.join(outputDir, "01-invoice-e-document-panel.png"),
      fullPage: true,
    });

    const previewButton = page.getByRole("button", { name: /Önizle ve doğrula/i });
    if (await previewButton.isVisible()) {
      await previewButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(outputDir, "02-preview-result.png"),
        fullPage: true,
      });
    }

    console.log(`Screenshot'lar kaydedildi: ${outputDir}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
