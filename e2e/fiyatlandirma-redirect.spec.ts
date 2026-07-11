import { expect, test } from "@playwright/test";
import {
  cleanupAuthFixture,
  E2E_AUTH_PASSWORD,
  seedAuthFixture,
} from "./seed-auth-fixture";

test("anonim /fiyatlandirma ana sayfa fiyatlar anchorına yönlendirir", async ({
  page,
}) => {
  const response = await page.goto("/fiyatlandirma?utm_source=qa5e", {
    waitUntil: "commit",
  });

  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/(\?utm_source=qa5e)?#fiyatlar/);
  await expect(page.locator("#fiyatlar")).toBeVisible();
});

test("anonim /fiyatlandirma redirect loop oluşturmaz", async ({ page }) => {
  let redirectCount = 0;
  page.on("response", (response) => {
    if ([301, 302, 307, 308].includes(response.status())) {
      redirectCount += 1;
    }
  });

  await page.goto("/fiyatlandirma", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/#fiyatlar/);
  expect(redirectCount).toBeLessThanOrEqual(2);
});

test("oturumlu /fiyatlandirma UTM query korunarak yönlendirir", async ({
  page,
}) => {
  const fixture = await seedAuthFixture();

  try {
    await page.goto("/login");
    await page.fill("#email", fixture.email);
    await page.fill("#password", E2E_AUTH_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

    const response = await page.goto(
      "/fiyatlandirma?utm_campaign=qa5e-auth&utm_medium=e2e",
      { waitUntil: "commit" }
    );

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(
      /\/?(\?utm_campaign=qa5e-auth&utm_medium=e2e)?#fiyatlar/
    );
    await expect(page.locator("#fiyatlar")).toBeVisible();
  } finally {
    await cleanupAuthFixture(fixture);
  }
});
