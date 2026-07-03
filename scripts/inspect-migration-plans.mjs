import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const plans = await db.membershipPlan.findMany({
    where: {
      OR: [
        { code: { contains: "standart", mode: "insensitive" } },
        { name: { contains: "Standart", mode: "insensitive" } },
        { name: { contains: "STANDART", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      code: true,
      planStatus: true,
      isActive: true,
      visibility: true,
      currency: true,
      defaultCurrency: true,
      monthlyPrice: true,
      quarterlyPrice: true,
      semiAnnualPrice: true,
      yearlyPrice: true,
    },
  });
  console.log("PLANS:", JSON.stringify(plans, null, 2));

  for (const p of plans) {
    const prices = await db.membershipPlanPrice.findMany({
      where: { planId: p.id },
      select: {
        id: true,
        billingInterval: true,
        status: true,
        salePriceMinor: true,
        listPriceMinor: true,
        effectiveFrom: true,
        effectiveUntil: true,
        version: true,
        currency: true,
        isPublic: true,
      },
      orderBy: [{ billingInterval: "asc" }, { version: "desc" }],
    });
    console.log(`PRICES for ${p.code}:`, JSON.stringify(prices, null, 2));

    const subCount = await db.companySubscription.count({
      where: {
        planId: p.id,
        status: { in: ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END", "PAST_DUE", "GRACE_PERIOD"] },
      },
    });
    const subs = await db.companySubscription.findMany({
      where: {
        planId: p.id,
        status: { in: ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END", "PAST_DUE", "GRACE_PERIOD"] },
      },
      take: 5,
      select: {
        id: true,
        billingInterval: true,
        lockedPlanPriceId: true,
        planId: true,
        status: true,
      },
    });
    console.log(`SUBS (${subCount}) sample for ${p.code}:`, JSON.stringify(subs, null, 2));
  }

  const archived = await db.membershipPlan.findFirst({
    where: { planStatus: "ARCHIVED" },
    select: { id: true, name: true, code: true },
  });
  if (archived) {
    const subs = await db.companySubscription.findMany({
      where: {
        planId: archived.id,
        status: { in: ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END"] },
      },
      take: 10,
      select: {
        id: true,
        billingInterval: true,
        lockedPlanPriceId: true,
        billingPeriodSnapshot: true,
      },
    });
    console.log(`ARCHIVED ${archived.name} (${archived.code}) subs:`, JSON.stringify(subs, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
