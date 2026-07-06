/**
 * Playwright E2E fixture seed/cleanup — yalnız TEST_DATABASE_URL'e karşı
 * çalışır (production'a karşı ASLA). Test sonunda oluşturduğu kayıtları
 * temizler, başka tenant/mevcut verilere dokunmaz.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DB_URL || !TEST_DB_URL.includes("_test")) {
  throw new Error(
    "seed-product-edit-fixture yalnız _test veritabanına karşı çalışabilir."
  );
}

const db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

export const E2E_USER_EMAIL = `e2e-product-${Date.now()}@qa.internal`;
export const E2E_USER_PASSWORD = "E2ETestPass123!";

export async function seedProductEditFixture() {
  // lib/auth.ts next/headers'a bağımlı zincir içeriyor — Playwright'ın kendi
  // modül yükleyicisi tsconfig path alias'larını çözemiyor. bcrypt'i doğrudan
  // kullanmak (lib/auth.ts'in hashPassword'ünün birebir aynısı) bu bağımlılığı
  // aşar.
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(E2E_USER_PASSWORD, 10);
  const stamp = `e2e-${Date.now()}-${randomUUID().slice(0, 6)}`;

  const user = await db.user.create({
    data: {
      email: E2E_USER_EMAIL,
      password: hash,
      name: "E2E Product Tester",
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const company = await db.company.create({
    data: { name: `E2E Product Co ${stamp}`, status: "ACTIVE" },
  });

  await db.companyUser.create({
    data: { userId: user.id, companyId: company.id, role: "OWNER", isOwner: true, status: "ACTIVE" },
  });

  await db.companySubscription.create({
    data: {
      companyId: company.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const product = await db.product.create({
    data: {
      companyId: company.id,
      name: `E2E Test Ürünü ${stamp}`,
      productType: "STOCK",
      stock: 10,
      sellPrice: 150,
      status: "ACTIVE",
    },
  });

  return { userId: user.id, companyId: company.id, productId: product.id };
}

export async function cleanupProductEditFixture(ids: {
  userId: string;
  companyId: string;
  productId: string;
}) {
  await db.stockMovement.deleteMany({ where: { companyId: ids.companyId } });
  await db.product.deleteMany({ where: { id: ids.productId } });
  await db.companySubscription.deleteMany({ where: { companyId: ids.companyId } });
  await db.companyUser.deleteMany({ where: { companyId: ids.companyId } });
  await db.company.deleteMany({ where: { id: ids.companyId } });
  await db.user.deleteMany({ where: { id: ids.userId } });
  await db.$disconnect();
}
