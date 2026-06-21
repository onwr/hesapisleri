import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import { WarehouseDetailClient } from "@/components/stocks/warehouse-detail-client";
import { canManageWarehouses } from "@/lib/permission-utils";
import { getStockFormOptions } from "@/lib/stocks-page-data";
import { getWarehouseDetailData } from "@/lib/warehouse-page-data";

type Props = { params: Promise<{ id: string }> };

export default async function WarehouseDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await guardPageModule("products");
  const company = session.company;
  const membership = session.companyUser;
  const effectiveRole = session.effectiveRole;

  const canManage = canManageWarehouses(effectiveRole, membership?.isOwner ?? false);

  const [data, transferOptions] = await Promise.all([
    getWarehouseDetailData(company.id, id),
    canManage ? getStockFormOptions(company.id) : Promise.resolve(null),
  ]);

  if (!data) notFound();

  const { warehouse, metrics, stockRows, movements, transfers } = data;

  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
            Depo yükleniyor...
          </div>
        }
      >
        <WarehouseDetailClient
        warehouse={{
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
          note: warehouse.note,
          address: warehouse.address,
          isDefault: warehouse.isDefault,
          status: warehouse.status,
        }}
        metrics={metrics}
        stockRows={stockRows}
        movements={movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          quantity: movement.quantity,
          note: movement.note,
          createdAt: movement.createdAt.toISOString(),
          product: movement.product,
        }))}
        transfers={transfers.map((transfer) => ({
          id: transfer.id,
          transferNo: transfer.transferNo,
          quantity: transfer.quantity,
          status: transfer.status,
          createdAt: transfer.createdAt.toISOString(),
          product: transfer.product,
          fromWarehouse: transfer.fromWarehouse,
          toWarehouse: transfer.toWarehouse,
          createdBy: transfer.createdBy,
        }))}
        canManage={canManage}
        transferProducts={transferOptions?.products}
        transferWarehouses={transferOptions?.warehouses}
      />
      </Suspense>
    </AppShell>
  );
}
