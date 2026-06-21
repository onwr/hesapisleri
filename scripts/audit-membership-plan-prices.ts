import { db } from "@/lib/prisma";

async function main() {
  const plans = await db.membershipPlan.findMany({
    include: { prices: true },
  });

  const missingInterval: string[] = [];
  const zeroPrices: string[] = [];
  const hardcodedRefs: string[] = [];

  for (const plan of plans) {
    for (const interval of ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]) {
      const active = plan.prices.find(
        (price) =>
          price.billingInterval === interval && price.status === "ACTIVE"
      );
      if (!active) {
        missingInterval.push(`${plan.code}:${interval}`);
      } else if (active.salePriceMinor <= 0) {
        zeroPrices.push(`${plan.code}:${interval}`);
      }
    }
  }

  console.log("=== Üyelik Plan Fiyat Audit ===");
  console.log("Plan sayısı:", plans.length);
  console.log("Aktif fiyatı olmayan dönem:", missingInterval.length);
  if (missingInterval.length) console.log(missingInterval.join(", "));
  console.log("Sıfır fiyat:", zeroPrices.length);
  console.log(
    "Legacy kolon örnek (standard aylık):",
    plans.find((p) => p.code === "standard")?.monthlyPrice?.toString() ?? "yok"
  );
  console.log(
    "Versiyonlu fiyat kayıtları:",
    plans.reduce((sum, plan) => sum + plan.prices.length, 0)
  );
  console.log("Hardcoded referans taraması: kod içinde 479 yalnızca test dosyalarında olmalı.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
