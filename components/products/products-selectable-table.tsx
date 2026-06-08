"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Package,
  Percent,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { ProductDeleteFeedbackDialog } from "@/components/products/product-delete-feedback-dialog";
import { ProductsBulkResultDialog } from "@/components/products/products-bulk-result-dialog";
import { ProductsPriceBulkDialog } from "@/components/products/products-price-bulk-dialog";
import { ProductsRowActions } from "@/components/products/products-row-actions";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import type { ProductDeleteBlockCode } from "@/lib/product-delete-utils";
import {
  formatProductMoney,
  getCategoryBadge,
  getProductStatusBadge,
  getStockLevelStyle,
  type ProductTableRow,
} from "@/lib/products-page-utils";

type ProductsSelectableTableProps = {
  rows: ProductTableRow[];
  exportHref: string;
  hasFilters: boolean;
};

export function ProductsSelectableTable({
  rows,
  exportHref,
  hasFilters,
}: ProductsSelectableTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    code: ProductDeleteBlockCode | "GENERIC";
    message: string;
    saleItemCount?: number;
    transferCount?: number;
  } | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    open: boolean;
    title: string;
    summary: string;
    successCount: number;
    failed: Array<{ productId: string; message: string; code?: string }>;
  } | null>(null);

  const productNameById = useMemo(
    () => Object.fromEntries(rows.map((row) => [row.id, row.name])),
    [rows]
  );

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((row) => row.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(
    payload: Record<string, unknown>,
    options?: { clearSelection?: boolean }
  ) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          data?: {
            deleted?: number;
            updated?: number;
            failed?: Array<{
              productId: string;
              message: string;
              code?: string;
            }>;
          };
        };

        if (!response.ok || !result.success) {
          setBulkResult({
            open: true,
            title: "Toplu işlem başarısız",
            summary: result.message ?? "İşlem tamamlanamadı.",
            successCount: 0,
            failed: [],
          });
          return;
        }

        const rawFailed = result.data?.failed ?? [];
        const failed = rawFailed.map((item) => ({
          productId: item.productId,
          message: item.message,
          code: item.code,
        }));
        const successCount =
          result.data?.deleted ?? result.data?.updated ?? selectedIds.size;

        if (failed.length > 0) {
          setBulkResult({
            open: true,
            title: "Toplu işlem tamamlandı",
            summary: result.message ?? "",
            successCount,
            failed,
          });
        }

        if (options?.clearSelection !== false) {
          setSelectedIds(new Set());
        }

        router.refresh();
      } catch {
        setBulkResult({
          open: true,
          title: "Hata",
          summary: "Toplu işlem sırasında bir hata oluştu.",
          successCount: 0,
          failed: [],
        });
      }
    });
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    const confirmed = window.confirm(
      `${count} ürünü kalıcı olarak silmek istediğinize emin misiniz?\n\nSatış veya transfer geçmişi olan ürünler silinmez; sonuç özeti gösterilir.`
    );
    if (!confirmed) return;

    runBulk({
      action: "delete",
      productIds: [...selectedIds],
    });
  }

  function handleBulkStatus(status: "ACTIVE" | "PASSIVE") {
    runBulk({
      action: "set-status",
      productIds: [...selectedIds],
      status,
    });
  }

  function handleBulkPrice(input: {
    priceField: "sell" | "buy" | "both";
    direction: "increase" | "decrease";
    mode: "percent" | "fixed";
    value: number;
  }) {
    setPriceDialogOpen(false);
    runBulk({
      action: "adjust-price",
      productIds: [...selectedIds],
      ...input,
    });
  }

  function handleDeleteBlocked(payload: {
    productId: string;
    productName: string;
    code?: string;
    message: string;
    saleItemCount?: number;
    transferCount?: number;
  }) {
    setDeleteFeedback({
      open: true,
      productId: payload.productId,
      productName: payload.productName,
      code:
        payload.code === "SALE_HISTORY" || payload.code === "TRANSFER_HISTORY"
          ? payload.code
          : "GENERIC",
      message: payload.message,
      saleItemCount: payload.saleItemCount,
      transferCount: payload.transferCount,
    });
  }

  function handleSetPassive(productId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set-status", status: "PASSIVE" }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) return;

        setDeleteFeedback(null);
        router.refresh();
      } catch {
        // ignore
      }
    });
  }

  return (
    <>
      {someSelected ? (
        <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-black text-[#0f1f4d]">
              {selectedIds.size} ürün seçildi
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-700"
            >
              <X size={14} />
              Seçimi temizle
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setPriceDialogOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-60"
            >
              <Percent size={14} />
              Fiyat güncelle
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulkStatus("PASSIVE")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-60"
            >
              <Power size={14} />
              Pasife al
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              <Power size={14} />
              Aktifleştir
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkDelete}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[12px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <Trash2 size={14} />
              Seçilenleri sil
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tümünü seç"
                />
              </th>
              <th className="px-4 py-3">Ürün Adı</th>
              <th className="px-4 py-3">Stok Kodu</th>
              <th className="px-4 py-3">Barkod</th>
              <th className="px-4 py-3">Grup</th>
              <th className="px-4 py-3">Stok Miktarı</th>
              <th className="px-4 py-3">Birim Fiyat</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-center">İşlemler</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((product) => {
              const statusBadge = getProductStatusBadge(product.status);
              const isSelected = selectedIds.has(product.id);

              return (
                <tr
                  key={product.id}
                  className={[
                    "text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80",
                    isSelected ? "bg-blue-50/40" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      checked={isSelected}
                      onChange={() => toggleOne(product.id)}
                      aria-label={`${product.name} seç`}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumbnail
                        imageUrl={product.imageUrl}
                        alt={product.name}
                        size={40}
                        iconSize={18}
                        rounded="lg"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-[#0f1f4d]">
                          {product.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                          {product.description || "Açıklama yok"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 font-bold text-[#24345f]">
                    {product.sku}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {product.barcode || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        getCategoryBadge(product.categoryName),
                      ].join(" ")}
                    >
                      {product.categoryName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "font-black tracking-[-0.01em]",
                        getStockLevelStyle(product.stock),
                      ].join(" ")}
                    >
                      {product.isService ? "—" : `${product.stock} adet`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-[#24345f]">
                    {formatProductMoney(product.sellPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "rounded-md px-2 py-1 text-[10px] font-black",
                        statusBadge.className,
                      ].join(" ")}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProductsRowActions
                      row={{
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        status: product.status,
                        isService: product.isService,
                        exportHref,
                      }}
                      onDeleteBlocked={handleDeleteBlocked}
                    />
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-16 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
                      <Package size={28} />
                    </div>
                    <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                      {hasFilters
                        ? "Bu filtrede ürün bulunamadı"
                        : "Henüz ürün yok"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {hasFilters
                        ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz."
                        : "İlk ürününüzü ekleyerek satış ve stok takibine başlayabilirsiniz."}
                    </p>
                    <Link
                      href={hasFilters ? "/products" : "/products/new"}
                      className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-black text-white"
                    >
                      {hasFilters ? "Filtreyi Temizle" : "İlk Ürünü Ekle"}
                    </Link>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ProductDeleteFeedbackDialog
        state={deleteFeedback}
        onClose={() => setDeleteFeedback(null)}
        onSetPassive={handleSetPassive}
        isPending={isPending}
      />

      <ProductsPriceBulkDialog
        open={priceDialogOpen}
        selectedCount={selectedIds.size}
        onClose={() => setPriceDialogOpen(false)}
        onApply={handleBulkPrice}
        isPending={isPending}
      />

      <ProductsBulkResultDialog
        open={Boolean(bulkResult?.open)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? ""}
        successCount={bulkResult?.successCount ?? 0}
        failed={bulkResult?.failed ?? []}
        productNameById={productNameById}
        onClose={() => setBulkResult(null)}
      />
    </>
  );
}
