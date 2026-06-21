"use client";

import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Pencil, Star } from "lucide-react";
import { PRODUCT_STATS_BAR_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseBadge, WarehouseStatPill } from "@/components/warehouses/warehouses-shared";
import type { WarehouseFormRecord } from "@/components/stocks/warehouse-form-dialog";
import {
  formatStockMoney,
  formatStockNumber,
  PRODUCTS_STOCKS_WAREHOUSES_PATH,
} from "@/lib/stocks-page-utils";
import { parseWarehouseAddress } from "@/lib/warehouse-admin-service";
import { getWarehouseStatusLabel } from "@/lib/warehouse-utils";

type WarehouseDetailHeaderProps = {
  warehouse: WarehouseFormRecord & { address: string | null };
  metrics: {
    productCount: number;
    totalStock: number;
    totalValue: number;
    lowStockCount: number;
  };
  canManage: boolean;
  onEdit: () => void;
  onTransfer: () => void;
  onSetDefault: () => void;
  onToggleStatus: () => void;
};

export function WarehouseDetailHeader({
  warehouse,
  metrics,
  canManage,
  onEdit,
  onTransfer,
  onSetDefault,
  onToggleStatus,
}: WarehouseDetailHeaderProps) {
  const parsed = parseWarehouseAddress(warehouse.address);
  const location =
    [parsed.city, parsed.district].filter(Boolean).join(" / ") ||
    parsed.address ||
    "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Link
            href={PRODUCTS_STOCKS_WAREHOUSES_PATH}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200"
            aria-label="Depo listesine dön"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-xl font-extrabold text-[#0f1f4d]">{warehouse.name}</h1>
              {warehouse.isDefault ? (
                <WarehouseBadge tone="blue">Ana Depo</WarehouseBadge>
              ) : null}
              <WarehouseBadge tone={warehouse.status === "ACTIVE" ? "emerald" : "slate"}>
                {getWarehouseStatusLabel(warehouse.status)}
              </WarehouseBadge>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {warehouse.code ? `Kod: ${warehouse.code}` : "Kod tanımlı değil"}
            </p>
            {location ? (
              <p className="mt-1 text-[12px] text-slate-600">{location}</p>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onTransfer}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-black"
            >
              <ArrowLeftRight size={14} />
              Transfer Yap
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-black"
            >
              <Pencil size={14} />
              Düzenle
            </button>
            {!warehouse.isDefault ? (
              <button
                type="button"
                onClick={onSetDefault}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-black"
              >
                <Star size={14} />
                Ana Depo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleStatus}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-[12px] font-black"
            >
              {warehouse.status === "ACTIVE" ? "Pasife Al" : "Aktif Et"}
            </button>
          </div>
        ) : null}
      </div>

      <section
        className={`${PRODUCT_STATS_BAR_CLASS} flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        <WarehouseStatPill label="Ürün Çeşidi" value={String(metrics.productCount)} />
        <WarehouseStatPill label="Toplam Stok" value={formatStockNumber(metrics.totalStock)} />
        <WarehouseStatPill
          label="Stok Değeri"
          value={formatStockMoney(metrics.totalValue)}
          tone="blue"
        />
        <WarehouseStatPill
          label="Düşük Stok"
          value={String(metrics.lowStockCount)}
          tone={metrics.lowStockCount > 0 ? "amber" : "slate"}
        />
      </section>
    </div>
  );
}

export type WarehouseDetailTab = "stocks" | "movements" | "transfers" | "details";

export function WarehouseDetailTabs({
  activeTab,
  onChange,
}: {
  activeTab: WarehouseDetailTab;
  onChange: (tab: WarehouseDetailTab) => void;
}) {
  const tabs: Array<{ key: WarehouseDetailTab; label: string }> = [
    { key: "stocks", label: "Stoklar" },
    { key: "movements", label: "Hareketler" },
    { key: "transfers", label: "Transferler" },
    { key: "details", label: "Depo Bilgileri" },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={[
            "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition",
            activeTab === tab.key
              ? "bg-[#0f1f4d] text-white"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
