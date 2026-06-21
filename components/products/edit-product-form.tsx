"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
  Save,
  Sparkles,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { ProductFormFields } from "@/components/products/product-form-fields";
import { ProductImageUpload } from "@/components/products/product-image-upload";
import { ProductPreviewPanel } from "@/components/products/product-preview-panel";
import {
  buildProductPayload,
  getFirstProductErrorMessage,
  mapProductFieldErrors,
  productToFormValues,
  resolveInitialBarcodePayloadMode,
  shouldIncludeBarcodeInJsonPayload,
  type ProductBarcodePayloadMode,
  type ProductFormValues,
  type ProductUnitType,
} from "@/lib/product-form-utils";

type EditProductFormProps = {
  companyId: string;
  product: {
    id: string;
    productType?: "STOCK" | "SERVICE";
    name: string;
    sku: string | null;
    barcode: string | null;
    description: string | null;
    imageUrl: string | null;
    status: string;
    stock: number;
    minStock: number;
    unitType: ProductUnitType;
    warehouseLocation: string | null;
    buyPrice: unknown;
    sellPrice: unknown;
    vatRate: number;
    category?: { name: string } | null;
  };
};

export function EditProductForm({ companyId, product }: EditProductFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ProductFormValues>(() =>
    productToFormValues(product)
  );
  const [barcodePayloadMode, setBarcodePayloadMode] =
    useState<ProductBarcodePayloadMode>(() =>
      resolveInitialBarcodePayloadMode("edit", product.barcode)
    );

  function updateForm(key: keyof ProductFormValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const payload = buildProductPayload(form, { barcodeMode: barcodePayloadMode });
    const { stock: _stock, ...updatePayload } = payload;
    const requestBody = shouldIncludeBarcodeInJsonPayload(barcodePayloadMode)
      ? updatePayload
      : Object.fromEntries(
          Object.entries(updatePayload).filter(([key]) => key !== "barcode")
        );

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFieldErrors(mapProductFieldErrors(data.errors));
        setError(
          getFirstProductErrorMessage(data.message, data.errors) ||
            "Ürün güncellenemedi."
        );
        return;
      }

      router.push(`/products/${product.id}?updated=1`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="products"
          title="Ürün güncelleniyor"
          subtitle="Ürün bilgileri kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href={`/products/${product.id}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Ürün Düzenleme
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  {product.name}
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Fiyat, kategori, barkod ve durum bilgilerini güncelleyin. Stok
                  değişiklikleri stok hareketleri üzerinden yapılır.
                </p>
              </div>
            </div>

            <TopMiniCard
              label="Mevcut Stok"
              value={String(product.stock)}
              icon={<Package size={17} />}
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <ProductImageUpload
              companyId={companyId}
              value={form.imageUrl}
              onChange={(imageUrl) => updateForm("imageUrl", imageUrl)}
            />

            <ProductFormFields
              form={form}
              fieldErrors={fieldErrors}
              mode="edit"
              currentStock={product.stock}
              barcodePayloadMode={barcodePayloadMode}
              onBarcodePayloadModeChange={setBarcodePayloadMode}
              onChange={updateForm}
              onUnitTypeChange={(value: ProductUnitType) =>
                setForm((prev) => ({ ...prev, unitType: value }))
              }
              onStatusChange={(value) =>
                setForm((prev) => ({ ...prev, status: value }))
              }
            />

            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={19} />
                )}
                {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </button>

              <Link
                href={`/products/${product.id}`}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </Link>
            </div>
          </form>

          <ProductPreviewPanel
            form={{ ...form, stock: String(product.stock) }}
          />
        </section>
      </div>
    </main>
  );
}

function TopMiniCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-w-[150px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate text-[13px] font-black text-[#0f1f4d]">{value}</p>
      </div>
    </div>
  );
}
