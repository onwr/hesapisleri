"use client";

import { useMemo, useState } from "react";
import { Percent, Power, Printer, Trash2, X } from "lucide-react";
import { ProductDeleteFeedbackDialog } from "@/components/products/product-delete-feedback-dialog";
import { ProductEmptyState } from "@/components/products/product-empty-state";
import { ProductListRow } from "@/components/products/product-list-row";
import { ProductTableDesktopRow } from "@/components/products/product-table-desktop-row";
import { ProductsBulkResultDialog } from "@/components/products/products-bulk-result-dialog";
import { ProductsPriceBulkDialog } from "@/components/products/products-price-bulk-dialog";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import type { ProductDeleteBlockCode } from "@/lib/product-delete-utils";
import { printProductBarcodesBulk } from "@/lib/product-ui-utils";
import { formatProductMoney, type ProductTableRow } from "@/lib/products-page-utils";

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
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    const result = await mutate("/api/products/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      setBulkResult({
        open: true,
        title: "Toplu işlem başarısız",
        summary: result.error ?? "İşlem tamamlanamadı.",
        successCount: 0,
        failed: [],
      });
      return;
    }

    const data = result.data as {
      deleted?: number;
      updated?: number;
      failed?: Array<{
        productId: string;
        message: string;
        code?: string;
      }>;
    } | undefined;

    const rawFailed = data?.failed ?? [];
    const failed = rawFailed.map((item) => ({
      productId: item.productId,
      message: item.message,
      code: item.code,
    }));
    const successCount =
      data?.deleted ?? data?.updated ?? selectedIds.size;

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

  async function handleSetPassive(productId: string) {
    const result = await mutate(`/api/products/${productId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-status", status: "PASSIVE" }),
    });

    if (result.ok) {
      setDeleteFeedback(null);
    }
  }

  function handleBulkPrintBarcodes() {
    const selected = rows.filter((row) => selectedIds.has(row.id));
    printProductBarcodesBulk(
      selected.map((row) => ({
        name: row.name,
        barcode: row.barcode,
        sku: row.sku,
        sellPriceLabel: formatProductMoney(row.sellPrice),
      }))
    );
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
              disabled={isSubmitting}
              onClick={handleBulkPrintBarcodes}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-60"
            >
              <Printer size={14} />
              Barkod Yazdır
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setPriceDialogOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-60"
            >
              <Percent size={14} />
              Fiyat güncelle
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleBulkStatus("PASSIVE")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] hover:bg-slate-50 disabled:opacity-60"
            >
              <Power size={14} />
              Pasife al
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              <Power size={14} />
              Aktifleştir
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBulkDelete}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[12px] font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <Trash2 size={14} />
              Seçilenleri sil
            </button>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-black text-slate-500">
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th className="px-3 py-2">Ürün</th>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2 text-right">Satış Fiyatı</th>
                  <th className="px-3 py-2 text-right">Stok</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <ProductTableDesktopRow
                    key={product.id}
                    product={product}
                    exportHref={exportHref}
                    selected={selectedIds.has(product.id)}
                    onToggleSelect={toggleOne}
                    onDeleteBlocked={handleDeleteBlocked}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Tümünü seç"
              />
              <span className="text-[11px] font-bold text-slate-500">
                Toplu işlem için seçin
              </span>
            </div>
            {rows.map((product) => (
              <ProductListRow
                key={product.id}
                product={product}
                exportHref={exportHref}
                selected={selectedIds.has(product.id)}
                onToggleSelect={toggleOne}
                showCheckbox
                onDeleteBlocked={handleDeleteBlocked}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="p-3">
          <ProductEmptyState hasFilters={hasFilters} />
        </div>
      )}

      <ProductsPriceBulkDialog
        open={priceDialogOpen}
        onClose={() => setPriceDialogOpen(false)}
        selectedCount={selectedIds.size}
        onApply={handleBulkPrice}
        isPending={isSubmitting}
      />

      <ProductDeleteFeedbackDialog
        state={deleteFeedback}
        onClose={() => setDeleteFeedback(null)}
        onSetPassive={handleSetPassive}
        isPending={isSubmitting}
      />

      <ProductsBulkResultDialog
        open={Boolean(bulkResult?.open)}
        onClose={() => setBulkResult(null)}
        title={bulkResult?.title ?? ""}
        summary={bulkResult?.summary ?? ""}
        successCount={bulkResult?.successCount ?? 0}
        failed={bulkResult?.failed ?? []}
        productNameById={productNameById}
      />
    </>
  );
}
