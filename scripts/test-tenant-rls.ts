/**
 * Integration test for PostgreSQL RLS (requires DATABASE_URL).
 * Run: npm run test:rls
 */
import { db } from "../lib/prisma";
import { withTenantDb } from "../lib/tenant/tenant-db";

async function main() {
  const companies = await db.company.findMany({
    take: 2,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (companies.length < 2) {
    console.log("SKIP: Need at least 2 companies for RLS integration test.");
    return;
  }

  const [companyA, companyB] = companies;

  const customerA = await db.customer.findFirst({
    where: { companyId: companyA.id },
    select: { id: true },
  });

  if (!customerA) {
    console.log("SKIP: No customer for company A.");
    return;
  }

  const visibleInA = await withTenantDb(companyA.id, async (tx) =>
    tx.customer.findFirst({
      where: { id: customerA.id },
      select: { id: true },
    })
  );

  if (!visibleInA) {
    throw new Error("RLS: Company A customer not visible in A context.");
  }

  const visibleInB = await withTenantDb(companyB.id, async (tx) =>
    tx.customer.findFirst({
      where: { id: customerA.id },
      select: { id: true },
    })
  );

  if (visibleInB) {
    throw new Error("RLS: Company A customer leaked into B context.");
  }

  const role = await db.$queryRaw<
    Array<{ rolsuper: boolean; rolbypassrls: boolean }>
  >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;

  const current = role[0];
  if (current?.rolsuper || current?.rolbypassrls) {
    console.warn(
      "WARN: Runtime DB role has SUPERUSER or BYPASSRLS — RLS may not enforce in production."
    );
  }

  console.log("RLS integration checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
