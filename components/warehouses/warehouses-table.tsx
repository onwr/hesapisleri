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
import { PRODUCT_CARD_CLASS } from "@/components/products/product-ui-tokens";
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

type WarehouseRowActionsProps = {
  warehouse: WarehouseListItem;
  canManage: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onToggleStatus: () => void;
  onTransfer: () => void;
};

function WarehouseRowActions({
  warehouse,
  canManage,
  onEdit,
  onSetDefault,
  onToggleStatus,
  onTransfer,
}: WarehouseRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-lg border border-slate-200 p-1.5"
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
                Stok Hareketleri
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

export function WarehousesTable({
  rows,
  canManage,
  isPending,
  onEdit,
  onSetDefault,
  onToggleStatus,
  onTransfer,
}: {
  rows: WarehouseListItem[];
  canManage: boolean;
  isPending: boolean;
  onEdit: (warehouse: WarehouseListItem) => void;
  onSetDefault: (warehouse: WarehouseListItem) => void;
  onToggleStatus: (warehouse: WarehouseListItem) => void;
  onTransfer: (warehouse: WarehouseListItem) => void;
}) {
  return (
    <section className={`hidden overflow-x-auto md:block ${PRODUCT_CARD_CLASS}`}>
      <table className="w-full min-w-[1040px] text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-black text-slate-600">
            <th className="px-3 py-2.5">Depo</th>
            <th className="px-3 py-2.5">Kod</th>
            <th className="px-3 py-2.5">Konum</th>
            <th className="px-3 py-2.5">Ürün Çeşidi</th>
            <th className="px-3 py-2.5">Toplam Stok</th>
            <th className="px-3 py-2.5">Stok Değeri</th>
            <th className="px-3 py-2.5">Durum</th>
            <th className="px-3 py-2.5">Son Güncelleme</th>
            <th className="px-3 py-2.5 text-right">İşlemler</th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-slate-100 ${isPending ? "opacity-60" : ""}`}>
          {rows.map((warehouse) => {
            const parsed = parseWarehouseAddress(warehouse.address);
            const location =
              [parsed.city, parsed.district].filter(Boolean).join(" / ") ||
              parsed.address ||
              "—";

            return (
              <tr key={warehouse.id} className="text-[12px] font-semibold text-[#24345f]">
                <td className="px-3 py-2.5">
                  <Link
                    href={buildProductsStocksWarehouseHref(warehouse.id)}
                    className="group block min-w-0"
                  >
                    <div className="flex items-center gap-2 font-black text-[#0f1f4d] group-hover:text-blue-700">
                      <Warehouse size={14} className="shrink-0 text-blue-500" />
                      <span className="truncate">{warehouse.name}</span>
                      {warehouse.isDefault ? (
                        <WarehouseBadge tone="blue">Ana Depo</WarehouseBadge>
                      ) : null}
                    </div>
                    {parsed.address ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                        {parsed.address}
                      </p>
                    ) : null}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{warehouse.code || "—"}</td>
                <td className="px-3 py-2.5">{location}</td>
                <td className="px-3 py-2.5">{warehouse.metrics.productCount}</td>
                <td className="px-3 py-2.5">{formatStockNumber(warehouse.metrics.totalStock)}</td>
                <td className="px-3 py-2.5">{formatStockMoney(warehouse.metrics.totalValue)}</td>
                <td className="px-3 py-2.5">
                  <WarehouseBadge tone={warehouse.status === "ACTIVE" ? "emerald" : "slate"}>
                    {getWarehouseStatusLabel(warehouse.status)}
                  </WarehouseBadge>
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {new Date(warehouse.updatedAt).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={buildProductsStocksWarehouseHref(warehouse.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-black"
                    >
                      Görüntüle
                    </Link>
                    <WarehouseRowActions
                      warehouse={warehouse}
                      canManage={canManage}
                      onEdit={() => onEdit(warehouse)}
                      onSetDefault={() => onSetDefault(warehouse)}
                      onToggleStatus={() => onToggleStatus(warehouse)}
                      onTransfer={() => onTransfer(warehouse)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function WarehouseMobileCard({
  warehouse,
  canManage,
  onEdit,
  onSetDefault,
  onToggleStatus,
  onTransfer,
}: {
  warehouse: WarehouseListItem;
  canManage: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onToggleStatus: () => void;
  onTransfer: () => void;
}) {
  const parsed = parseWarehouseAddress(warehouse.address);

  return (
    <article className={`${PRODUCT_CARD_CLASS} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-black text-[#0f1f4d]">{warehouse.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{warehouse.code || "Kodsuz"}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {warehouse.isDefault ? <WarehouseBadge tone="blue">Ana Depo</WarehouseBadge> : null}
          <WarehouseBadge tone={warehouse.status === "ACTIVE" ? "emerald" : "slate"}>
            {getWarehouseStatusLabel(warehouse.status)}
          </WarehouseBadge>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] font-semibold text-slate-600">
        <p>Konum: {[parsed.city, parsed.district].filter(Boolean).join(" / ") || "—"}</p>
        <p>Ürün: {warehouse.metrics.productCount}</p>
        <p>Stok: {formatStockNumber(warehouse.metrics.totalStock)}</p>
        <p>Değer: {formatStockMoney(warehouse.metrics.totalValue)}</p>
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        Son güncelleme: {new Date(warehouse.updatedAt).toLocaleDateString("tr-TR")}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={buildProductsStocksWarehouseHref(warehouse.id)}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-[#0f1f4d] text-[11px] font-black text-white"
        >
          Görüntüle
        </Link>
        <WarehouseRowActions
          warehouse={warehouse}
          canManage={canManage}
          onEdit={onEdit}
          onSetDefault={onSetDefault}
          onToggleStatus={onToggleStatus}
          onTransfer={onTransfer}
        />
      </div>
    </article>
  );
}

export { PRODUCTS_STOCKS_PATH };
