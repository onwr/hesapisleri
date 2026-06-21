"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Warehouse } from "lucide-react";
import {
  WarehouseFormDialog,
  type WarehouseFormRecord,
} from "@/components/stocks/warehouse-form-dialog";
import type {
  StockFormProduct,
  StockFormWarehouse,
} from "@/components/stocks/stock-movement-modal";
import { WarehouseTransferModal } from "@/components/stocks/warehouse-transfer-modal";
import { PRODUCT_EMPTY_STATE_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseCardGrid } from "@/components/warehouses/warehouse-card-grid";
import {
  DEFAULT_WAREHOUSES_FILTERS,
  WarehousesFilters,
  type WarehousesFilterState,
} from "@/components/warehouses/warehouses-filters";
import { WarehousesRecentTransfers } from "@/components/warehouses/warehouses-recent-transfers";
import { WarehousesShell } from "@/components/warehouses/warehouses-shell";
import type { RecentTransferRow } from "@/lib/warehouse-page-data";
import type { WarehousePageStats } from "@/lib/warehouses-page-ui-utils";
import { parseWarehouseAddress } from "@/lib/warehouse-admin-service";
import { PRODUCTS_STOCKS_PATH } from "@/lib/stocks-page-utils";

export type WarehouseListItem = WarehouseFormRecord & {
  updatedAt: string;
  lastMovementAt: string | null;
  metrics: {
    productCount: number;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
  };
};

type WarehousesPageClientProps = {
  warehouses: WarehouseListItem[];
  stats: WarehousePageStats;
  recentTransfers: RecentTransferRow[];
  canManage: boolean;
  canSyncStock?: boolean;
  transferProducts?: StockFormProduct[];
  transferWarehouses?: StockFormWarehouse[];
};

const WAREHOUSE_API = "/api/products/stocks/warehouses";

export function WarehousesPageClient({
  warehouses,
  stats,
  recentTransfers,
  canManage,
  canSyncStock = false,
  transferProducts = [],
  transferWarehouses = [],
}: WarehousesPageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<WarehousesFilterState>(
    DEFAULT_WAREHOUSES_FILTERS
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseListItem | null>(
    null
  );
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | undefined>();
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLowerCase();

    return warehouses
      .filter((warehouse) => {
        if (filters.statusFilter !== "all" && warehouse.status !== filters.statusFilter) {
          return false;
        }

        if (filters.stockFilter === "low" && warehouse.metrics.lowStockCount === 0) {
          return false;
        }

        if (filters.stockFilter === "empty" && warehouse.metrics.totalStock !== 0) {
          return false;
        }

        if (!normalizedQuery) return true;

        const parsed = parseWarehouseAddress(warehouse.address);
        const haystack = [
          warehouse.name,
          warehouse.code ?? "",
          parsed.city,
          parsed.district,
          parsed.address,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (filters.sortKey === "stock") {
          return right.metrics.totalStock - left.metrics.totalStock;
        }

        if (filters.sortKey === "value") {
          return right.metrics.totalValue - left.metrics.totalValue;
        }

        if (filters.sortKey === "recent") {
          const leftTime = left.lastMovementAt
            ? new Date(left.lastMovementAt).getTime()
            : 0;
          const rightTime = right.lastMovementAt
            ? new Date(right.lastMovementAt).getTime()
            : 0;
          return rightTime - leftTime;
        }

        return left.name.localeCompare(right.name, "tr");
      });
  }, [warehouses, filters]);

  function refreshPage(message?: string) {
    if (message) {
      setBanner({ tone: "success", text: message });
    }

    startTransition(() => {
      router.refresh();
    });
  }

  function openCreateDialog() {
    setDialogMode("create");
    setSelectedWarehouse(null);
    setDialogOpen(true);
  }

  function openEditDialog(warehouse: WarehouseListItem) {
    setDialogMode("edit");
    setSelectedWarehouse(warehouse);
    setDialogOpen(true);
  }

  function openTransferDialog(warehouse?: WarehouseListItem) {
    setTransferFromId(warehouse?.id);
    setTransferOpen(true);
  }

  function handleQuickAction(
    key: "create" | "transfer" | "movement" | "lowStock"
  ) {
    if (key === "create") {
      openCreateDialog();
      return;
    }

    if (key === "transfer") {
      openTransferDialog();
      return;
    }

    if (key === "movement") {
      router.push(PRODUCTS_STOCKS_PATH);
      return;
    }

    setFilters((current) => ({
      ...current,
      stockFilter: "low",
    }));
  }

  async function patchWarehouse(id: string, body: Record<string, unknown>) {
    const response = await fetch(`${WAREHOUSE_API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      setBanner({
        tone: "error",
        text: data.message || "Depo işlemi tamamlanamadı.",
      });
      return false;
    }

    refreshPage(data.message);
    return true;
  }

  function handleSetDefault(warehouse: WarehouseListItem) {
    void patchWarehouse(warehouse.id, { action: "setDefault" });
  }

  function handleToggleStatus(warehouse: WarehouseListItem) {
    const nextStatus = warehouse.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    const label = nextStatus === "PASSIVE" ? "pasife almak" : "aktif etmek";

    setConfirmAction({
      title: "Depo durumunu değiştir",
      message: `"${warehouse.name}" deposunu ${label} istediğinize emin misiniz?`,
      onConfirm: () => {
        setConfirmAction(null);
        void patchWarehouse(warehouse.id, { status: nextStatus });
      },
    });
  }

  return (
    <WarehousesShell
      stats={stats}
      canManage={canManage}
      canSyncStock={canSyncStock}
      onQuickAction={handleQuickAction}
    >
      {banner ? (
        <div
          className={[
            "rounded-lg px-3 py-2 text-[12px] font-bold",
            banner.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          {banner.text}
        </div>
      ) : null}

      <WarehousesFilters filters={filters} onChange={setFilters} />

      {filteredRows.length === 0 ? (
        <section className={PRODUCT_EMPTY_STATE_CLASS}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Warehouse size={22} />
          </div>
          <p className="mt-3 text-sm font-black text-[#0f1f4d]">
            {warehouses.length === 0
              ? "Henüz depo oluşturulmamış"
              : "Bu filtrede depo bulunamadı"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {warehouses.length === 0
              ? "Stoklarınızı ayrı konumlarda takip etmek için ilk deponuzu oluşturun."
              : "Arama veya filtre kriterlerinizi değiştirin."}
          </p>
          {canManage && warehouses.length === 0 ? (
            <button
              type="button"
              onClick={openCreateDialog}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#0f1f4d] px-4 text-[12px] font-black text-white"
            >
              İlk Depoyu Oluştur
            </button>
          ) : null}
        </section>
      ) : (
        <WarehouseCardGrid
          rows={filteredRows}
          canManage={canManage}
          onEdit={openEditDialog}
          onSetDefault={handleSetDefault}
          onToggleStatus={handleToggleStatus}
          onTransfer={openTransferDialog}
        />
      )}

      <WarehousesRecentTransfers transfers={recentTransfers} />

      <WarehouseFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={(message) => refreshPage(message)}
        mode={dialogMode}
        warehouse={selectedWarehouse}
        canManage={canManage}
      />

      {canManage && transferProducts.length > 0 && transferWarehouses.length > 0 ? (
        <WarehouseTransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          products={transferProducts}
          warehouses={transferWarehouses}
          defaultFromWarehouseId={transferFromId}
        />
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-black text-[#0f1f4d]">{confirmAction.title}</h3>
            <p className="mt-2 text-[13px] text-slate-600">{confirmAction.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-9 rounded-lg border border-slate-200 px-3 text-[12px] font-black"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className="h-9 rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </WarehousesShell>
  );
}
