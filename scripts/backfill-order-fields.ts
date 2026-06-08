import { db } from "../lib/prisma";

async function main() {
  const sales = await db.sale.findMany({
    select: {
      id: true,
      status: true,
      saleNo: true,
      note: true,
      sourceChannel: true,
      orderStatus: true,
    },
  });

  let updated = 0;

  for (const sale of sales) {
    const data: {
      sourceChannel?: "MANUAL" | "POS";
      orderStatus?:
        | "WAITING"
        | "APPROVED"
        | "CANCELLED"
        | "RETURNED";
    } = {};

    if (!sale.sourceChannel) {
      const haystack = `${sale.note ?? ""} ${sale.saleNo}`.toLowerCase();
      data.sourceChannel =
        haystack.includes("pos") || sale.saleNo.startsWith("POS-")
          ? "POS"
          : "MANUAL";
    }

    if (sale.status === "CANCELLED") {
      data.orderStatus = "CANCELLED";
    } else if (sale.status === "REFUNDED") {
      data.orderStatus = "RETURNED";
    } else if (sale.status === "DRAFT") {
      data.orderStatus = "WAITING";
    } else if (sale.orderStatus === "WAITING") {
      data.orderStatus = "APPROVED";
    }

    if (Object.keys(data).length > 0) {
      await db.sale.update({
        where: { id: sale.id },
        data,
      });
      updated += 1;
    }
  }

  console.log(`Backfill tamamlandı. Güncellenen kayıt: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
