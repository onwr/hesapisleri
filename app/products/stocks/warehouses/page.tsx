import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { WarehousesPageClient } from "@/components/stocks/warehouses-page-client";
import {
  canManageProducts,
  canManageWarehouses,
} from "@/lib/permission-utils";
import { getStockFormOptions } from "@/lib/stocks-page-data";
import { getWarehousesPageData } from "@/lib/warehouse-page-data";
import { getCachedWarehousesPageData } from "@/lib/tenant-cache/cached-tenant-page-data";

export default async function WarehousesPage() {
  const session = await guardPageModule("products");
  const company = session.company;
  const membership = session.companyUser;
  const effectiveRole = session.effectiveRole;


  const canManage = canManageWarehouses(effectiveRole, membership?.isOwner ?? false);
  const canSyncStock = canManageProducts(effectiveRole, membership?.isOwner ?? false);

  const [{ warehouses, stats, recentTransfers }, transferOptions] = await Promise.all([
    getCachedWarehousesPageData({ companyId: company.id }),
    canManage ? getStockFormOptions(company.id) : Promise.resolve(null),
  ]);

  return (
    <AppShell>
      <WarehousesPageClient
        warehouses={warehouses}
        stats={stats}
        recentTransfers={recentTransfers}
        canManage={canManage}
        canSyncStock={canSyncStock}
        transferProducts={transferOptions?.products}
        transferWarehouses={transferOptions?.warehouses}
      />
    </AppShell>
  );
}
