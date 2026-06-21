import { auditSubscriptionLegacyMismatches } from "../lib/billing/subscription-legacy-sync";
import { db } from "../lib/prisma";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;

  const report = await auditSubscriptionLegacyMismatches(limit);

  console.log("=== Legacy CompanySettings / CompanySubscription Audit ===");
  console.log(`Kontrol edilen abonelik: ${report.checked}`);
  console.log(`Aboneliği olmayan firma: ${report.withoutSubscription}`);
  console.log(`Uyuşmazlık: ${report.mismatches.length}`);
  console.log("");

  for (const row of report.mismatches) {
    console.log(
      `- ${row.companyName} (${row.companyId}) · ${row.field}: subscription=${row.subscriptionValue} settings=${row.settingsValue}`
    );
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
