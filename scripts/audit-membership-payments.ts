import { db } from "@/lib/prisma";

async function main() {
  const [
    activeSubscriptions,
    duplicateSubscriptions,
    activeWithoutPaidPayment,
    missingPlanSubscriptions,
    expiredTrials,
    manualPayments,
  ] = await Promise.all([
    db.companySubscription.count({
      where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD"] } },
    }),
    db.$queryRaw<Array<{ companyId: string; count: bigint }>>`
      SELECT "companyId", COUNT(*)::bigint as count
      FROM "CompanySubscription"
      GROUP BY "companyId"
      HAVING COUNT(*) > 1
    `,
    db.companySubscription.findMany({
      where: {
        status: "ACTIVE",
        company: {
          membershipPayments: {
            none: { status: "PAID", provider: { not: "TRIAL" } },
          },
        },
      },
      select: { id: true, companyId: true },
    }),
    db.companySubscription.count({
      where: { planId: null, status: { in: ["TRIAL", "ACTIVE"] } },
    }),
    db.companySubscription.count({
      where: {
        status: "TRIAL",
        trialEndsAt: { lt: new Date() },
      },
    }),
    db.membershipPayment.count({
      where: { provider: { in: ["BANK_TRANSFER", "MANUAL", null] } },
    }),
  ]);

  const partnerMismatch = await db.partnerEarning.count({
    where: { description: { contains: "membershipPaymentId" } },
  });

  console.log("Membership Payment Audit");
  console.log("========================");
  console.log(`Active/trial subscriptions: ${activeSubscriptions}`);
  console.log(`Duplicate subscription companies: ${duplicateSubscriptions.length}`);
  console.log(`Active without paid payment: ${activeWithoutPaidPayment.length}`);
  console.log(`Active/trial subscriptions without plan: ${missingPlanSubscriptions}`);
  console.log(`Expired trial rows still TRIAL: ${expiredTrials}`);
  console.log(`Manual/legacy payment rows: ${manualPayments}`);
  console.log(`Partner earning descriptions with membershipPaymentId: ${partnerMismatch}`);

  if (duplicateSubscriptions.length > 0) {
    console.log("Duplicate companies:");
    for (const row of duplicateSubscriptions) {
      console.log(`- ${row.companyId}: ${String(row.count)}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
