import { repairMissingSubscriptions } from "../lib/admin-subscription-service";
import { db } from "../lib/prisma";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const companyArg = argv.find((a) => a.startsWith("--company-id="));
  const limitArg = argv.find((a) => a.startsWith("--limit="));

  return {
    dryRun: dryRun || !apply,
    companyId: companyArg?.split("=")[1],
    limit: limitArg ? Number(limitArg.split("=")[1]) : 100,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !process.argv.includes("--apply")) {
    console.error("Uygulamak için --apply bayrağı gerekli.");
    process.exit(1);
  }

  const result = await repairMissingSubscriptions({
    dryRun: args.dryRun,
    confirm: !args.dryRun,
    companyId: args.companyId,
    limit: args.limit,
  });

  console.log("=== Abonelik Backfill Raporu ===");
  console.log(`Mod: ${result.dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Aboneliği olmayan firma: ${result.missingCount}`);
  console.log(`Oluşturulacak/oluşturulan: ${result.dryRun ? result.items.filter((i) => i.action === "would_create").length : result.created}`);
  console.log(`Atlanan: ${result.skipped}`);
  console.log("");

  for (const item of result.items) {
    console.log(`- ${item.companyName} (${item.companyId})`);
    console.log(`  Aksiyon: ${item.action}`);
    console.log(`  Plan: ${item.planName ?? "—"}`);
    console.log(`  Trial bitiş: ${item.trialEndsAt ?? "—"}`);
    console.log(`  CompanySettings durumu: ${item.settingsStatus ?? "—"}`);
    if (item.conflict) console.log(`  Çakışma: ${item.conflict}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
