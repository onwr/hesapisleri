/**
 * Playwright E2E auth fixture — yalnız TEST_DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DB_URL || !TEST_DB_URL.includes("_test")) {
  throw new Error(
    "seed-auth-fixture yalnız _test veritabanına karşı çalışabilir."
  );
}

const db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

export const E2E_AUTH_PASSWORD = "E2EAuthPass123!";

export async function seedAuthFixture() {
  const email = `e2e-auth-${Date.now()}@qa.internal`;
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(E2E_AUTH_PASSWORD, 10);
  const stamp = `e2e-auth-${Date.now()}-${randomUUID().slice(0, 6)}`;

  const user = await db.user.create({
    data: {
      email,
      password: hash,
      name: "E2E Auth Tester",
      role: "OWNER",
      status: "ACTIVE",
      sessionVersion: 1,
      loginTrackingStatus: "NEVER_LOGGED_IN",
    },
  });

  const company = await db.company.create({
    data: { name: `E2E Auth Co ${stamp}`, status: "ACTIVE" },
  });

  await db.companyUser.create({
    data: {
      userId: user.id,
      companyId: company.id,
      role: "OWNER",
      isOwner: true,
      status: "ACTIVE",
    },
  });

  await db.companySubscription.create({
    data: {
      companyId: company.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  return { userId: user.id, companyId: company.id, email };
}

export async function cleanupAuthFixture(ids: {
  userId: string;
  companyId: string;
}) {
  await db.companySubscription.deleteMany({ where: { companyId: ids.companyId } });
  await db.companyUser.deleteMany({ where: { companyId: ids.companyId } });
  await db.company.deleteMany({ where: { id: ids.companyId } });
  await db.user.deleteMany({ where: { id: ids.userId } });
  await db.$disconnect();
}
