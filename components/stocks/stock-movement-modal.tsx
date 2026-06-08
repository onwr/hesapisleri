"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  calculateStockMovement,
  getQuantityFieldHint,
  getQuantityFieldLabel,
  STOCK_MOVEMENT_TYPE_LABELS,
  toDateTimeLocalValue,
  type StockMovementRequestType,
} from "@/lib/stock-movement-utils";

export type StockFormProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
};

export type StockFormWarehouse = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
};

type StockMovementModalProps = {
  open: boolean;
  onClose: () => void;
  movementType: StockMovementRequestType;
  products: StockFormProduct[];
  warehouses: StockFormWarehouse[];
  defaultProductId?: string;
  defaultWarehouseId?: string;
};

export function StockMovementModal({
  open,
  onClose,
  movementType,
  products,
  warehouses,
  defaultProductId,
  defaultWarehouseId,
}: StockMovementModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [movementDate, setMovementDate] = useState(() => toDateTimeLocalValue());

  useEffect(() => {
    if (open) {
      const defaultWarehouse =
        warehouses.find((w) => w.id === defaultWarehouseId) ??
        warehouses.find((w) => w.isDefault) ??
        warehouses[0];
      setProductId(defaultProductId ?? products[0]?.id ?? "");
      setWarehouseId(defaultWarehouse?.id ?? "");
      setQuantity("");
      setNote("");
      setMovementDate(toDateTimeLocalValue());
      setError("");
    }
  }, [open, defaultProductId, defaultWarehouseId, products, warehouses]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  const previewError = useMemo(() => {
    if (!quantity.trim() || !selectedProduct) return "";
    const parsed = Number(quantity);
    if (Number.isNaN(parsed)) return "Geçerli bir miktar girin.";
    const result = calculateStockMovement(
      movementType,
      selectedProduct.stock,
      parsed
    );
    return "error" in result ? result.error : "";
  }, [movementType, quantity, selectedProduct]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const parsedQuantity = Number(quantity);
    if (!productId || !warehouseId) {
      setError("Ürün ve depo seçin.");
      setSaving(false);
      return;
    }

    if (quantity.trim() === "" || Number.isNaN(parsedQuantity)) {
      setError("Geçerli bir miktar girin.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/stocks/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          type: movementType,
          quantity: parsedQuantity,
          warehouseId,
          note: note.trim() || undefined,
          movementDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Stok hareketi kaydedilemedi.");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">
              {STOCK_MOVEMENT_TYPE_LABELS[movementType]}
            </h2>
            <p className="text-[12px] font-medium text-slate-500">
              Ürün ve depo seçerek hareket oluşturun
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <Field label="Ürün" required>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            >
              <option value="">Ürün seçin</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.sku ? ` (${product.sku})` : ""} — Toplam: {product.stock}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Depo" required>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            >
              <option value="">Depo seçin</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.isDefault ? " (Varsayılan)" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={getQuantityFieldLabel(movementType)}
            hint={getQuantityFieldHint(movementType)}
            required
          >
            <input
              type="number"
              step={movementType === "ADJUSTMENT" ? "any" : "1"}
              min={movementType === "COUNT" ? "0" : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            />
          </Field>

          <Field label="İşlem Tarihi" required>
            <input
              type="datetime-local"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            />
          </Field>

          <Field label="Not">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
              placeholder="Opsiyonel"
            />
          </Field>

          {previewError ? (
            <p className="text-[12px] font-bold text-rose-600">{previewError}</p>
          ) : null}
          {error ? (
            <p className="text-[12px] font-bold text-rose-600">{error}</p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || Boolean(previewError)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] text-[13px] font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : null}
              Kaydet
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 px-5 text-[13px] font-black text-slate-600"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {hint ? (
        <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p>
      ) : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}
