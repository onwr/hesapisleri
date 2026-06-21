import { db } from "@/lib/prisma";
import { getDemoActivityCleanupWhere } from "@/lib/activity-log-utils";

async function main() {
  const apply = process.argv.includes("--apply");
  const where = getDemoActivityCleanupWhere();

  const matches = await db.activityLog.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      module: true,
      action: true,
      message: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Bulunan demo activity kaydı: ${matches.length}`);

  for (const row of matches) {
    console.log(
      `- ${row.id} | ${row.module}/${row.action} | ${row.message ?? "(boş)"}`
    );
  }

  if (!apply) {
    console.log("\nDry-run tamamlandı. Silmek için --apply kullanın.");
    return;
  }

  if (matches.length === 0) {
    console.log("Silinecek kayıt yok.");
    return;
  }

  const result = await db.activityLog.deleteMany({ where });
  console.log(`\nSilinen kayıt: ${result.count}`);
}

main()
  .catch((error) => {
    console.error("CLEANUP_DEMO_ACTIVITY_LOGS_ERROR", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
