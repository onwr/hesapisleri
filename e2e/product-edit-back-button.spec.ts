import { test, expect } from "@playwright/test";
import {
  seedProductEditFixture,
  cleanupProductEditFixture,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
} from "./seed-product-edit-fixture";

/**
 * Ürün düzenle → kaydet → detay → tarayıcı geri → liste regresyon senaryosu.
 * Test verisi TEST_DATABASE_URL'e seed edilir ve test sonunda temizlenir.
 * Production URL'ye karşı çalıştırılmaz (playwright.config.ts baseURL her
 * zaman yerel dev server).
 */
let fixtureIds: { userId: string; companyId: string; productId: string };

test.beforeAll(async () => {
  fixtureIds = await seedProductEditFixture();
});

test.afterAll(async () => {
  await cleanupProductEditFixture(fixtureIds);
});

test("ürün düzenle → kaydet → detay → geri → liste, hata görünmez", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  // 1. Login
  await page.goto("/login");
  await page.fill("#email", E2E_USER_EMAIL);
  await page.fill("#password", E2E_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  // 2. Ürün listesini aç
  await page.goto("/products");
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  // 3. Mevcut ürünü düzenle
  await page.goto(`/products/${fixtureIds.productId}/edit`);
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  // 4. Kaydet
  const saveButton = page.getByRole("button", { name: /Değişiklikleri Kaydet/i });
  await saveButton.click();

  // 5. Ürün detayının açıldığını doğrula
  await page.waitForURL(new RegExp(`/products/${fixtureIds.productId}(\\?|$)`), {
    timeout: 15_000,
  });
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  // 6-7. Tarayıcı geri davranışı → liste açılır.
  // Gerçek history zinciri: /products -> /products/[id]/edit -> /products/[id]
  // (kaydetme sonrası router.push). Tek goBack() edit sayfasına döner (o da
  // hatasız render edilmeli); ikinci goBack() listeye döner.
  await page.goBack();
  await page.waitForURL(new RegExp(`/products/${fixtureIds.productId}/edit`), {
    timeout: 15_000,
  });
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  await page.goBack();
  await page.waitForURL(/\/products(\?|$)/, { timeout: 15_000 });

  // 8. "Bir şeyler ters gitti" görünmemeli
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  // 10. Detaya tekrar gir — (olası cache-hit) ISO string'e dönüşmüş tarih
  // alanları hâlâ hatasız render edilmeli (toIsoString regresyon kilidi).
  await page.goto(`/products/${fixtureIds.productId}`);
  await expect(page.getByText("Bir şeyler ters gitti")).toHaveCount(0);

  // 9. Console'da hydration error / uncaught TypeError olmamalı
  const criticalErrors = consoleErrors.filter(
    (e) => /hydration|TypeError|is not a function/i.test(e)
  );
  expect(criticalErrors).toEqual([]);
});
