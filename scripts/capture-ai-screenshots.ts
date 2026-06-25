/**
 * AI Faz 1 görsel doğrulama screenshot'ları.
 *
 * Kullanım:
 *   cd web
 *   npm run dev   (ayrı terminal)
 *   AI_BASE_URL=http://localhost:3000 AI_EMAIL=... AI_PASSWORD=... npx tsx scripts/capture-ai-screenshots.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.AI_BASE_URL ?? "http://localhost:3000";
const email = process.env.AI_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const password = process.env.AI_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const outputDir =
  process.env.AI_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "ai-visual");

type Shot = {
  name: string;
  path: string;
  viewport: { width: number; height: number };
};

const shots: Shot[] = [
  {
    name: "ai-assistant-1440",
    path: "/ai-assistant",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ai-assistant-390",
    path: "/ai-assistant",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ai-settings-1440",
    path: "/settings/ai",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "dashboard-ai-summary-1440",
    path: "/dashboard",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ai-usage-admin-1440",
    path: "/settings/ai/usage",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "sales-ai-insight-1440",
    path: "/sales",
    viewport: { width: 1440, height: 900 },
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
    console.error("AI_EMAIL ve AI_PASSWORD ortam değişkenleri gerekli.");
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
  await page.waitForURL(/\/(dashboard|sales|ai-assistant)/, { timeout: 30000 }).catch(() => {
    // login redirect farklı olabilir
  });

  for (const shot of shots) {
    await page.setViewportSize(shot.viewport);
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const file = path.join(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`Kaydedildi: ${file}`);
  }

  await browser.close();
  console.log(`Tamamlandı: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
