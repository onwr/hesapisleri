import { db } from "../lib/prisma";
import {
  ensureProductWarehouseStock,
  getOrCreateDefaultWarehouse,
  syncProductTotalStock,
} from "../lib/warehouse-service";

async function backfillCompany(companyId: string) {
  const defaultWarehouse = await getOrCreateDefaultWarehouse(companyId);

  const products = await db.product.findMany({
    where: { companyId },
    select: { id: true, name: true, stock: true },
  });

  let created = 0;
  let synced = 0;
  let mismatches = 0;

  for (const product of products) {
    const existingCount = await db.warehouseStock.count({
      where: { companyId, productId: product.id },
    });

    if (existingCount === 0) {
      await ensureProductWarehouseStock(
        companyId,
        product.id,
        defaultWarehouse.id
      );
      created += 1;
    }

    const updated = await syncProductTotalStock(companyId, product.id);
    synced += 1;

    const warehouseTotal = await db.warehouseStock.aggregate({
      where: { companyId, productId: product.id },
      _sum: { quantity: true },
    });

    const total = warehouseTotal._sum.quantity ?? 0;
    if (total !== updated.stock) {
      mismatches += 1;
      console.warn(
        `Uyumsuzluk: ${product.name} depo toplamı=${total}, product.stock=${updated.stock}`
      );
    }
  }

  return { created, synced, mismatches, warehouseId: defaultWarehouse.id };
}

async function main() {
  console.log("Warehouse stock backfill başlatılıyor...");

  const companies = await db.company.findMany({
    select: { id: true, name: true },
  });

  for (const company of companies) {
    const result = await backfillCompany(company.id);
    console.log(
      `${company.name}: ${result.created} yeni kayıt, ${result.synced} senkron, ${result.mismatches} uyumsuzluk`
    );
  }

  console.log("Backfill tamamlandı.");
}

main()
  .catch((error) => {
    console.error("Backfill hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
