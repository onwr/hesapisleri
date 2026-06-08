"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type {
  StockFormProduct,
  StockFormWarehouse,
} from "@/components/stocks/stock-movement-modal";
import { toDateTimeLocalValue } from "@/lib/stock-movement-utils";

type WarehouseTransferModalProps = {
  open: boolean;
  onClose: () => void;
  products: StockFormProduct[];
  warehouses: StockFormWarehouse[];
  defaultProductId?: string;
  defaultFromWarehouseId?: string;
};

export function WarehouseTransferModal({
  open,
  onClose,
  products,
  warehouses,
  defaultProductId,
  defaultFromWarehouseId,
}: WarehouseTransferModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [fromWarehouseId, setFromWarehouseId] = useState(
    defaultFromWarehouseId ?? ""
  );
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [transferDate, setTransferDate] = useState(() => toDateTimeLocalValue());

  useEffect(() => {
    if (open) {
      const defaultFrom =
        warehouses.find((w) => w.id === defaultFromWarehouseId) ??
        warehouses.find((w) => w.isDefault) ??
        warehouses[0];
      setProductId(defaultProductId ?? products[0]?.id ?? "");
      setFromWarehouseId(defaultFrom?.id ?? "");
      setToWarehouseId("");
      setQuantity("");
      setNote("");
      setTransferDate(toDateTimeLocalValue());
      setError("");
    }
  }, [open, defaultProductId, defaultFromWarehouseId, products, warehouses]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const parsedQuantity = Number(quantity);

    if (!productId || !fromWarehouseId || !toWarehouseId) {
      setError("Ürün ve depoları seçin.");
      setSaving(false);
      return;
    }

    if (fromWarehouseId === toWarehouseId) {
      setError("Çıkış ve giriş deposu aynı olamaz.");
      setSaving(false);
      return;
    }

    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setError("Geçerli bir miktar girin.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/stocks/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: parsedQuantity,
          note: note.trim() || undefined,
          transferDate,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Transfer tamamlanamadı.");
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
              Depo Transferi
            </h2>
            <p className="text-[12px] font-medium text-slate-500">
              Depolar arası stok transferi başlatın
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
                  {product.sku ? ` (${product.sku})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Çıkış Deposu" required>
            <select
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            >
              <option value="">Depo seçin</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Giriş Deposu" required>
            <select
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            >
              <option value="">Depo seçin</option>
              {warehouses
                .filter((w) => w.id !== fromWarehouseId)
                .map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Miktar" required>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            />
          </Field>

          <Field label="Transfer Tarihi" required>
            <input
              type="datetime-local"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              required
            />
          </Field>

          <Field label="Not">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-medium"
            />
          </Field>

          {error ? (
            <p className="text-[12px] font-bold text-rose-600">{error}</p>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 text-[13px] font-black text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : null}
              Transferi Başlat
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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
