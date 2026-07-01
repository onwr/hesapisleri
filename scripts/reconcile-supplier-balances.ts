/**
 * Tedarikçi cari bakiye mutabakatı.
 *
 * Kullanım:
 *   npx tsx scripts/reconcile-supplier-balances.ts --companyId=<id>
 *   npx tsx scripts/reconcile-supplier-balances.ts --companyId=<id> --apply
 */
import {
  applySupplierBalanceReconciliation,
  reconcileCompanySupplierBalances,
} from "../lib/supplier-reconciliation-service";

function parseArgs(argv: string[]) {
  let companyId: string | undefined;
  let apply = false;

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    if (arg.startsWith("--companyId=")) {
      companyId = arg.slice("--companyId=".length).trim();
    }
  }

  return { companyId, apply };
}

async function main() {
  const { companyId, apply } = parseArgs(process.argv.slice(2));

  if (!companyId) {
    console.error("companyId zorunlu. Örnek: --companyId=clxxx");
    process.exit(1);
  }

  const rows = await reconcileCompanySupplierBalances(companyId);
  const mismatches = rows.filter((row) => row.delta !== 0);

  console.log(`Toplam tedarikçi: ${rows.length}`);
  console.log(`Uyumsuz kayıt: ${mismatches.length}`);

  for (const row of mismatches) {
    console.log(
      `${row.supplierName} (${row.supplierId}) expected=${row.expectedBalance} current=${row.currentBalance} delta=${row.delta}`
    );
  }

  if (!apply) {
    if (mismatches.length > 0) {
      console.log("\nDry-run tamamlandı. Uygulamak için --apply ekleyin.");
    }
    return;
  }

  const result = await applySupplierBalanceReconciliation(
    companyId,
    mismatches.map((row) => row.supplierId)
  );

  console.log(`\nGüncellenen tedarikçi: ${result.updated}/${result.total}`);
}

main().catch((error) => {
  console.error("Mutabakat başarısız:", error instanceof Error ? error.message : error);
  process.exit(1);
});
