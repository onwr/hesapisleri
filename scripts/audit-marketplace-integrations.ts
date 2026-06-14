import { db } from "@/lib/prisma";

async function run() {
  const duplicateOrders = await db.sale.groupBy({
    by: ["companyId", "sourceChannel", "externalOrderId"],
    where: {
      sourceChannel: "TRENDYOL",
      externalOrderId: { not: null },
    },
    _count: { _all: true },
    having: {
      externalOrderId: { _count: { gt: 1 } },
    },
  });

  const emptyExternalOrderIds = await db.sale.count({
    where: {
      sourceChannel: "TRENDYOL",
      OR: [{ externalOrderId: null }, { externalOrderId: "" }],
    },
  });

  const duplicateMappings = await db.productChannelMapping.groupBy({
    by: ["companyId", "channel", "merchantSku"],
    _count: { _all: true },
    having: {
      merchantSku: { _count: { gt: 1 } },
    },
  });

  const failedRuns = await db.marketplaceSyncRun.findMany({
    where: { status: "FAILED" },
    select: {
      id: true,
      companyId: true,
      channel: true,
      startedAt: true,
      errors: true,
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  const waitingUnmatchedCount = await db.sale.count({
    where: {
      sourceChannel: "TRENDYOL",
      orderStatus: "WAITING",
      orderNote: { contains: "Eşleşmeyen SKU", mode: "insensitive" },
    },
  });

  console.log("=== Marketplace Audit Report ===");
  console.log("Duplicate Trendyol orders:", duplicateOrders.length);
  console.log("Trendyol empty externalOrderId count:", emptyExternalOrderIds);
  console.log("Duplicate product channel mappings:", duplicateMappings.length);
  console.log("Failed sync run count (latest 50 scanned):", failedRuns.length);
  console.log("WAITING unmatched SKU orders:", waitingUnmatchedCount);

  if (duplicateOrders.length) {
    console.log("\nDuplicate orders details:");
    for (const row of duplicateOrders) {
      console.log(
        `companyId=${row.companyId} channel=${row.sourceChannel} externalOrderId=${row.externalOrderId} count=${row._count._all}`
      );
    }
  }

  if (duplicateMappings.length) {
    console.log("\nDuplicate mapping details:");
    for (const row of duplicateMappings) {
      console.log(
        `companyId=${row.companyId} channel=${row.channel} merchantSku=${row.merchantSku} count=${row._count._all}`
      );
    }
  }

  if (failedRuns.length) {
    console.log("\nFailed sync runs:");
    for (const run of failedRuns) {
      console.log(
        `id=${run.id} companyId=${run.companyId} channel=${run.channel} startedAt=${run.startedAt.toISOString()}`
      );
    }
  }
}

run()
  .catch((error) => {
    console.error("Audit failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
