import { db } from "@/lib/prisma";
import {
  isDemoActivityMessage,
} from "@/lib/activity-log-utils";
import {
  assertDemoTenantCompany,
  isUnsafeDemoContent,
  resolveDemoCompany,
} from "@/lib/demo-tenant";

type CleanupReport = {
  demoCompanyId: string;
  unsafeActivityLogIds: string[];
  demoPatternActivityLogIds: string[];
  unsafeAccountIds: string[];
  unsafeCustomerIds: string[];
};

async function collectDemoCleanupReport(
  demoCompanyId: string
): Promise<CleanupReport> {
  const activityLogs = await db.activityLog.findMany({
    where: { companyId: demoCompanyId },
    select: { id: true, message: true },
    orderBy: { createdAt: "desc" },
  });

  const unsafeActivityLogIds: string[] = [];
  const demoPatternActivityLogIds: string[] = [];

  for (const row of activityLogs) {
    const message = row.message ?? "";
    if (isDemoActivityMessage(message)) {
      demoPatternActivityLogIds.push(row.id);
      continue;
    }
    if (isUnsafeDemoContent(message)) {
      unsafeActivityLogIds.push(row.id);
    }
  }

  const [accounts, customers] = await Promise.all([
    db.account.findMany({
      where: { companyId: demoCompanyId },
      select: { id: true, name: true },
    }),
    db.customer.findMany({
      where: { companyId: demoCompanyId },
      select: { id: true, name: true },
    }),
  ]);

  const unsafeAccountIds = accounts
    .filter((row) => isUnsafeDemoContent(row.name))
    .map((row) => row.id);

  const unsafeCustomerIds = customers
    .filter((row) => isUnsafeDemoContent(row.name))
    .map((row) => row.id);

  return {
    demoCompanyId,
    unsafeActivityLogIds,
    demoPatternActivityLogIds,
    unsafeAccountIds,
    unsafeCustomerIds,
  };
}

function printReport(report: CleanupReport, apply: boolean) {
  const removableIds = [
    ...new Set([
      ...report.unsafeActivityLogIds,
      ...report.demoPatternActivityLogIds,
    ]),
  ];

  console.log(`Demo tenant: ${report.demoCompanyId}`);
  console.log(`Unsafe activity logs: ${report.unsafeActivityLogIds.length}`);
  if (report.unsafeActivityLogIds.length > 0) {
    console.log(`  IDs: ${report.unsafeActivityLogIds.join(", ")}`);
  }

  console.log(
    `Demo-pattern activity logs: ${report.demoPatternActivityLogIds.length}`
  );
  if (report.demoPatternActivityLogIds.length > 0) {
    console.log(`  IDs: ${report.demoPatternActivityLogIds.join(", ")}`);
  }

  console.log(`Unsafe account names (report only): ${report.unsafeAccountIds.length}`);
  if (report.unsafeAccountIds.length > 0) {
    console.log(`  IDs: ${report.unsafeAccountIds.join(", ")}`);
  }

  console.log(
    `Unsafe customer names (report only): ${report.unsafeCustomerIds.length}`
  );
  if (report.unsafeCustomerIds.length > 0) {
    console.log(`  IDs: ${report.unsafeCustomerIds.join(", ")}`);
  }

  console.log(`Total removable activity logs: ${removableIds.length}`);

  if (!apply) {
    console.log("\nDry-run tamamlandı. Silmek için --apply kullanın.");
    return removableIds;
  }

  return removableIds;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const demoCompany = await resolveDemoCompany(db);

  if (!demoCompany) {
    console.error(
      "Canonical demo tenant bulunamadı. DEMO_COMPANY_ID veya DEMO-9988776655 tax no gerekli."
    );
    process.exitCode = 1;
    return;
  }

  assertDemoTenantCompany(demoCompany);

  const report = await collectDemoCleanupReport(demoCompany.id);
  const removableIds = printReport(report, apply);

  if (!apply || removableIds.length === 0) {
    if (apply && removableIds.length === 0) {
      console.log("Silinecek kayıt yok.");
    }
    return;
  }

  const result = await db.activityLog.deleteMany({
    where: {
      companyId: demoCompany.id,
      id: { in: removableIds },
    },
  });

  console.log(`\nSilinen activity log: ${result.count}`);
}

main()
  .catch((error) => {
    console.error("CLEANUP_DEMO_DATA_ERROR", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
