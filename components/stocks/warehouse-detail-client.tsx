"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductsSubNav } from "@/components/products/products-sub-nav";
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
import {
  WarehouseFormDialog,
  type WarehouseFormRecord,
} from "@/components/stocks/warehouse-form-dialog";
import type {
  StockFormProduct,
  StockFormWarehouse,
} from "@/components/stocks/stock-movement-modal";
import { WarehouseTransferModal } from "@/components/stocks/warehouse-transfer-modal";
import {
  WarehouseDetailHeader,
  WarehouseDetailTabs,
  type WarehouseDetailTab,
} from "@/components/warehouses/warehouse-detail-header";
import {
  WarehouseMovementsTab,
  type WarehouseMovementRow,
} from "@/components/warehouses/warehouse-movements-tab";
import { WarehouseStocksTab, type WarehouseStockRow } from "@/components/warehouses/warehouse-stocks-tab";
import {
  WarehouseTransfersTab,
  type WarehouseTransferRow,
} from "@/components/warehouses/warehouse-transfers-tab";
import { parseWarehouseAddress } from "@/lib/warehouse-admin-service";

type WarehouseDetailClientProps = {
  warehouse: WarehouseFormRecord & {
    address: string | null;
    note: string | null;
  };
  metrics: {
    productCount: number;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
  };
  stockRows: WarehouseStockRow[];
  movements: WarehouseMovementRow[];
  transfers: WarehouseTransferRow[];
  canManage: boolean;
  transferProducts?: StockFormProduct[];
  transferWarehouses?: StockFormWarehouse[];
};

const WAREHOUSE_API = "/api/products/stocks/warehouses";

function parseTab(value: string | null): WarehouseDetailTab {
  if (value === "movements" || value === "transfers" || value === "details") {
    return value;
  }
  return "stocks";
}

export function WarehouseDetailClient({
  warehouse,
  metrics,
  stockRows,
  movements,
  transfers,
  canManage,
  transferProducts = [],
  transferWarehouses = [],
}: WarehouseDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<WarehouseDetailTab>(() =>
    parseTab(searchParams.get("tab"))
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("edit") === "1" && canManage) {
      setDialogOpen(true);
    }
  }, [searchParams, canManage]);

  function changeTab(tab: WarehouseDetailTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  async function patchWarehouse(body: Record<string, unknown>) {
    const response = await fetch(`${WAREHOUSE_API}/${warehouse.id}`, {
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
      return;
    }

    setBanner({ tone: "success", text: data.message });
    startTransition(() => router.refresh());
  }

  function handleToggleStatus() {
    const nextStatus = warehouse.status === "ACTIVE" ? "PASSIVE" : "ACTIVE";
    const label = nextStatus === "PASSIVE" ? "pasife almak" : "aktif etmek";

    setConfirmAction({
      title: "Depo durumunu değiştir",
      message: `"${warehouse.name}" deposunu ${label} istediğinize emin misiniz?`,
      onConfirm: () => {
        setConfirmAction(null);
        void patchWarehouse({ status: nextStatus });
      },
    });
  }

  const parsed = parseWarehouseAddress(warehouse.address);

  return (
    <div className={`space-y-3 ${isPending ? "opacity-80" : ""}`}>
      <ProductsSubNav />

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

      <WarehouseDetailHeader
        warehouse={warehouse}
        metrics={metrics}
        canManage={canManage}
        onEdit={() => setDialogOpen(true)}
        onTransfer={() => setTransferOpen(true)}
        onSetDefault={() => patchWarehouse({ action: "setDefault" })}
        onToggleStatus={handleToggleStatus}
      />

      <WarehouseDetailTabs activeTab={activeTab} onChange={changeTab} />

      {activeTab === "stocks" ? <WarehouseStocksTab rows={stockRows} /> : null}
      {activeTab === "movements" ? (
        <WarehouseMovementsTab movements={movements} />
      ) : null}
      {activeTab === "transfers" ? (
        <WarehouseTransfersTab transfers={transfers} />
      ) : null}
      {activeTab === "details" ? (
        <section className={`${PRODUCT_CARD_CLASS} p-4 text-[12px]`}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Depo adı" value={warehouse.name} />
            <InfoItem label="Kod" value={warehouse.code || "—"} />
            <InfoItem label="İl" value={parsed.city || "—"} />
            <InfoItem label="İlçe" value={parsed.district || "—"} />
            <InfoItem label="Adres" value={parsed.address || "—"} />
            <InfoItem label="Açıklama" value={warehouse.note || "—"} />
          </dl>
        </section>
      ) : null}

      <WarehouseFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={(message) => {
          setBanner({ tone: "success", text: message });
          startTransition(() => router.refresh());
        }}
        mode="edit"
        warehouse={warehouse}
        canManage={canManage}
      />

      {canManage && transferProducts.length > 0 && transferWarehouses.length > 0 ? (
        <WarehouseTransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          products={transferProducts}
          warehouses={transferWarehouses}
          defaultFromWarehouseId={warehouse.id}
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
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-[#0f1f4d]">{value}</dd>
    </div>
  );
}
