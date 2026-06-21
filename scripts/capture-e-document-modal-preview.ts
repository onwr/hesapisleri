/**
 * E-Belge modal önizleme screenshot'ı (statik HTML).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outputDir = path.join(process.cwd(), "test-results", "e-document-modal");
const previewPath = path.join(outputDir, "preview.html");

async function main() {
  const { chromium } = await import("playwright");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
    await page.screenshot({
      path: path.join(outputDir, "e-document-modal-states.png"),
      fullPage: true,
    });
    console.log(`Screenshot kaydedildi: ${path.join(outputDir, "e-document-modal-states.png")}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
