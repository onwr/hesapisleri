import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DB_URL?.includes("_test")) {
  throw new Error("register-email E2E requires TEST_DATABASE_URL with _test suffix");
}

const db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

const REGISTER_PASSWORD = "E2ERegister123!";

test("kayıt formu name/autocomplete/KVKK ve gerçek e-posta kalıcılığı", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const email = `e2e-register-${Date.now()}@qa.internal`;

  await page.goto("/register");

  await page.goto("/login");
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  await page.goto("/register");

  const nameInput = page.locator('input[name="name"]');
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  await expect(nameInput).toHaveAttribute("autocomplete", "name");
  await expect(emailInput).toHaveAttribute("autocomplete", "email");
  await expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator("#kvkkInformed")).toBeVisible();

  await page.locator("#kvkkInformed").click();
  await page.getByRole("button", { name: "Okudum ve bilgilendirildim" }).click();

  await nameInput.fill("E2E");
  await emailInput.fill("gecersiz");
  await passwordInput.fill("123");
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Geçerli bir e-posta adresi girin/i)).toBeVisible();

  await nameInput.fill("E2E Register QA");
  await emailInput.fill(email);
  await passwordInput.fill(REGISTER_PASSWORD);
  await page.locator("#companyName").fill("E2E QA Company");

  await page.click('button[type="submit"]');
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 });

  const user = await db.user.findUnique({ where: { email } });
  expect(user?.email).toBe(email);
  expect(user?.email).not.toMatch(/yopmail/i);

  await page.goto("/settings");
  await page.getByRole("button", { name: /Kullanıcı ve Rol/i }).click();
  await expect(page.getByText(email)).toBeVisible();

  if (user) {
    const companyUser = await db.companyUser.findFirst({
      where: { userId: user.id },
      select: { companyId: true },
    });
    if (companyUser) {
      await db.companySubscription.deleteMany({
        where: { companyId: companyUser.companyId },
      });
      await db.companyUser.deleteMany({
        where: { companyId: companyUser.companyId },
      });
      await db.company.delete({ where: { id: companyUser.companyId } });
    }
    await db.userConsent.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

test.afterAll(async () => {
  await db.$disconnect();
});
