import { test, expect } from "@playwright/test";
import {
  cleanupAuthFixture,
  E2E_AUTH_PASSWORD,
  seedAuthFixture,
} from "./seed-auth-fixture";

let fixtureIds: { userId: string; companyId: string; email: string };

test.beforeAll(async () => {
  fixtureIds = await seedAuthFixture();
});

test.afterAll(async () => {
  await cleanupAuthFixture(fixtureIds);
});

test("oturumlu bilinmeyen dashboard URL — shell korunur, 404", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", fixtureIds.email);
  await page.fill("#password", E2E_AUTH_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();

  const response = await page.goto("/dashboard/bilinmeyen-sayfa");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "Sayfa bulunamadı" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş Yap" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Panele Dön" }).click();
  await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 15_000 });

  await page.goto("/dashboard/bilinmeyen-sayfa-2");
  await page.goBack();
  await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 15_000 });
});
