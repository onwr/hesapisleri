"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, Trash2 } from "lucide-react";

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
};

type MappingRow = {
  id: string;
  channel: "TRENDYOL" | "HEPSIBURADA";
  merchantSku: string;
  barcode: string | null;
  externalProductId: string | null;
  productId: string;
  product: ProductOption;
};

type ChannelMappingCenterProps = {
  products: ProductOption[];
  initialRows: MappingRow[];
  initialChannel: "TRENDYOL" | "HEPSIBURADA";
};

export function ChannelMappingCenter({
  products,
  initialRows,
  initialChannel,
}: ChannelMappingCenterProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [channel, setChannel] = useState<"TRENDYOL" | "HEPSIBURADA">(initialChannel);
  const [query, setQuery] = useState("");
  const [emptyMerchantOnly, setEmptyMerchantOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    productId: "",
    merchantSku: "",
    barcode: "",
    externalProductId: "",
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (row.channel !== channel) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          row.product.name.toLowerCase().includes(q) ||
          row.product.sku?.toLowerCase().includes(q) ||
          row.merchantSku.toLowerCase().includes(q)
        );
      }),
    [rows, channel, query]
  );
  const merchantSkuLabel =
    channel === "HEPSIBURADA"
      ? "Hepsiburada Merchant SKU / HB SKU"
      : "Trendyol Merchant SKU";

  const suggestedProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.sku &&
          !rows.some(
            (row) =>
              row.channel === channel &&
              row.productId === product.id &&
              row.merchantSku.toLowerCase() === product.sku?.toLowerCase()
          )
      ),
    [products, rows, channel]
  );

  async function refreshRows() {
    const response = await fetch(`/api/products/channel-mappings?channel=${channel}`);
    const result = await response.json();
    if (response.ok && result.success) {
      setRows(result.data);
    }
  }

  useEffect(() => {
    refreshRows();
  }, [channel]);

  useEffect(() => {
    router.replace(`/products/channel-mapping?channel=${channel}`);
  }, [channel, router]);

  async function createMapping() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/products/channel-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: draft.productId,
          channel,
          merchantSku: draft.merchantSku,
          barcode: draft.barcode || null,
          externalProductId: draft.externalProductId || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Eşleme oluşturulamadı.");
      }
      setMessage("Eşleme kaydedildi.");
      setDraft({ productId: "", merchantSku: "", barcode: "", externalProductId: "" });
      await refreshRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem başarısız.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMapping(id: string) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/products/channel-mappings/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message ?? "Eşleme silinemedi.");
      return;
    }
    setMessage("Eşleme silindi.");
    await refreshRows();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/products"
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          ← Ürünlere Dön
        </Link>
        <h1 className="mt-2 text-2xl font-black text-slate-950">
          Pazaryeri SKU Eşleme
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Merchant SKU ile panel ürünlerini eşleyin. Pazaryeri senkronları bu
          eşlemeyi öncelikli kullanır.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as "TRENDYOL" | "HEPSIBURADA")
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
          >
            <option value="TRENDYOL">Trendyol</option>
            <option value="HEPSIBURADA">Hepsiburada</option>
          </select>

          <select
            value={draft.productId}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, productId: event.target.value }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          >
            <option value="">Ürün seç</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} {product.sku ? `(${product.sku})` : ""}
              </option>
            ))}
          </select>

          <input
            value={draft.merchantSku}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, merchantSku: event.target.value }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder={merchantSkuLabel}
          />
          <input
            value={draft.barcode}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, barcode: event.target.value }))
            }
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="Barkod (opsiyonel)"
          />
          <button
            type="button"
            disabled={saving}
            onClick={createMapping}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Kaydet
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full bg-transparent text-sm outline-none"
            placeholder="Ürün adı, sku veya merchant sku ara..."
          />
        </div>
        <label className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={emptyMerchantOnly}
            onChange={(event) => setEmptyMerchantOnly(event.target.checked)}
          />
          Merchant SKU boş olanları göster
        </label>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-black text-slate-500">
                <th className="py-2">Ürün</th>
                <th className="py-2">Panel SKU</th>
                <th className="py-2">Merchant SKU</th>
                <th className="py-2">Barkod</th>
                <th className="py-2">External ID</th>
                <th className="py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.filter((row) => (emptyMerchantOnly ? !row.merchantSku.trim() : true))
                .length > 0 ? (
                filteredRows
                  .filter((row) => (emptyMerchantOnly ? !row.merchantSku.trim() : true))
                  .map((row) => (
                  <tr key={row.id} className="font-semibold text-slate-700">
                    <td className="py-2.5">{row.product.name}</td>
                    <td className="py-2.5">{row.product.sku ?? "—"}</td>
                    <td className="py-2.5">{row.merchantSku}</td>
                    <td className="py-2.5">{row.barcode ?? "—"}</td>
                    <td className="py-2.5">{row.externalProductId ?? "—"}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => deleteMapping(row.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 px-2 text-[11px] font-black text-rose-600"
                      >
                        <Trash2 size={12} />
                        Sil
                      </button>
                    </td>
                  </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black text-slate-900">SKU Otomatik Eşleme Önerileri</h3>
        <p className="mt-1 text-xs text-slate-500">
          Ürün SKU değeri merchant SKU olarak önerilir.
        </p>
        <div className="mt-3 space-y-2">
          {suggestedProducts.slice(0, 12).map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <p className="text-xs font-semibold text-slate-700">
                {product.name} ({product.sku})
              </p>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    productId: product.id,
                    merchantSku: product.sku ?? "",
                  }))
                }
                className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-black text-blue-700"
              >
                Öneriyi Kullan
              </button>
            </div>
          ))}
        </div>
      </section>

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
