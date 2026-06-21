"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Boxes,
  Eye,
  MoreHorizontal,
  Pencil,
  Star,
  ToggleLeft,
  Warehouse,
} from "lucide-react";
import type { WarehouseListItem } from "@/components/stocks/warehouses-page-client";
import { WarehouseBadge } from "@/components/warehouses/warehouses-shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildProductsStocksWarehouseHref,
  formatStockMoney,
  formatStockNumber,
  PRODUCTS_STOCKS_PATH,
} from "@/lib/stocks-page-utils";
import { parseWarehouseAddress } from "@/lib/warehouse-admin-service";
import { getWarehouseStatusLabel } from "@/lib/warehouse-utils";

type WarehouseCardActionsProps = {
  warehouse: WarehouseListItem;
  canManage: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onToggleStatus: () => void;
  onTransfer: () => void;
};

function WarehouseCardActions({
  warehouse,
  canManage,
  onEdit,
  onSetDefault,
  onToggleStatus,
  onTransfer,
}: WarehouseCardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
          aria-label={`${warehouse.name} işlemleri`}
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={buildProductsStocksWarehouseHref(warehouse.id)}>
            <Eye size={14} className="mr-2" />
            Depoyu Görüntüle
          </Link>
        </DropdownMenuItem>
        {canManage ? (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={14} className="mr-2" />
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${buildProductsStocksWarehouseHref(warehouse.id)}?tab=stocks`}>
                <Boxes size={14} className="mr-2" />
                Stokları Gör
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${buildProductsStocksWarehouseHref(warehouse.id)}?tab=movements`}>
                Stok hareketleri
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTransfer}>
              <ArrowLeftRight size={14} className="mr-2" />
              Transfer Yap
            </DropdownMenuItem>
            {!warehouse.isDefault ? (
              <DropdownMenuItem onClick={onSetDefault}>
                <Star size={14} className="mr-2" />
                Ana Depo Yap
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleStatus}>
              <ToggleLeft size={14} className="mr-2" />
              {warehouse.status === "ACTIVE" ? "Pasife Al" : "Aktif Et"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatLastMovement(value: string | null | undefined) {
  if (!value) return "Henüz hareket yok";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type WarehouseCardGridProps = {
  rows: WarehouseListItem[];
  canManage: boolean;
  onEdit: (warehouse: WarehouseListItem) => void;
  onSetDefault: (warehouse: WarehouseListItem) => void;
  onToggleStatus: (warehouse: WarehouseListItem) => void;
  onTransfer: (warehouse: WarehouseListItem) => void;
};

export function WarehouseCardGrid({
  rows,
  canManage,
  onEdit,
  onSetDefault,
  onToggleStatus,
  onTransfer,
}: WarehouseCardGridProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((warehouse) => {
        const parsed = parseWarehouseAddress(warehouse.address);
        const location =
          [parsed.city, parsed.district].filter(Boolean).join(" / ") ||
          parsed.address ||
          "Konum belirtilmemiş";

        return (
          <article
            key={warehouse.id}
            className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Warehouse size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="truncate text-sm font-black text-[#0f1f4d]">
                      {warehouse.name}
                    </h3>
                    {warehouse.isDefault ? (
                      <WarehouseBadge tone="blue">Ana Depo</WarehouseBadge>
                    ) : null}
                    <WarehouseBadge
                      tone={warehouse.status === "ACTIVE" ? "emerald" : "slate"}
                    >
                      {getWarehouseStatusLabel(warehouse.status)}
                    </WarehouseBadge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                    {[warehouse.code, location].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              <WarehouseCardActions
                warehouse={warehouse}
                canManage={canManage}
                onEdit={() => onEdit(warehouse)}
                onSetDefault={() => onSetDefault(warehouse)}
                onToggleStatus={() => onToggleStatus(warehouse)}
                onTransfer={() => onTransfer(warehouse)}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Ürün Çeşidi
                </p>
                <p className="mt-1 text-sm font-black text-[#0f1f4d]">
                  {formatStockNumber(warehouse.metrics.productCount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Toplam Stok
                </p>
                <p className="mt-1 text-sm font-black text-[#0f1f4d]">
                  {formatStockNumber(warehouse.metrics.totalStock)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Stok Değeri
                </p>
                <p className="mt-1 text-sm font-black text-[#0f1f4d]">
                  {formatStockMoney(warehouse.metrics.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Düşük Stok
                </p>
                <p
                  className={[
                    "mt-1 text-sm font-black",
                    warehouse.metrics.lowStockCount > 0
                      ? "text-amber-600"
                      : "text-[#0f1f4d]",
                  ].join(" ")}
                >
                  {formatStockNumber(warehouse.metrics.lowStockCount)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] font-medium text-slate-500">
              Son hareket:{" "}
              <span className="font-bold text-slate-700">
                {formatLastMovement(warehouse.lastMovementAt)}
              </span>
            </p>

            <div className="mt-3 flex gap-2">
              <Link
                href={buildProductsStocksWarehouseHref(warehouse.id)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                Depoyu Gör
              </Link>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => onTransfer(warehouse)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#0f1f4d] text-[12px] font-black text-white transition hover:bg-[#162a5c]"
                >
                  <ArrowLeftRight size={14} />
                  Transfer Yap
                </button>
              ) : (
                <Link
                  href={`${PRODUCTS_STOCKS_PATH}?warehouseId=${warehouse.id}`}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#0f1f4d] text-[12px] font-black text-white"
                >
                  Hareketler
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
