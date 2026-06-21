"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Boxes,
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
  emptyProductFormValues,
  getFirstProductErrorMessage,
  mapProductFieldErrors,
  resolveInitialBarcodePayloadMode,
  shouldIncludeBarcodeInJsonPayload,
  getUnitTypesForProductType,
  type ProductBarcodePayloadMode,
  type ProductFormValues,
  type ProductUnitType,
} from "@/lib/product-form-utils";
import type { ProductTypeKey } from "@/lib/product-type-utils";

type NewProductFormProps = {
  companyId: string;
  initialProductType?: ProductTypeKey;
};

export function NewProductForm({
  companyId,
  initialProductType = "STOCK",
}: NewProductFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ProductFormValues>(() => ({
    ...emptyProductFormValues,
    productType: initialProductType,
    stock: initialProductType === "SERVICE" ? "0" : emptyProductFormValues.stock,
    minStock: initialProductType === "SERVICE" ? "0" : emptyProductFormValues.minStock,
  }));
  const [barcodePayloadMode, setBarcodePayloadMode] =
    useState<ProductBarcodePayloadMode>("omit");

  function updateForm(key: keyof ProductFormValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleProductTypeChange(productType: ProductTypeKey) {
    const allowedUnits = getUnitTypesForProductType(productType);
    setForm((prev) => ({
      ...prev,
      productType,
      stock: productType === "SERVICE" ? "0" : prev.stock,
      minStock: productType === "SERVICE" ? "0" : prev.minStock,
      barcode: productType === "SERVICE" ? "" : prev.barcode,
      warehouseLocation: productType === "SERVICE" ? "" : prev.warehouseLocation,
      unitType: (allowedUnits as readonly ProductUnitType[]).includes(
        prev.unitType
      )
        ? prev.unitType
        : allowedUnits[0],
    }));

    if (productType === "SERVICE") {
      setBarcodePayloadMode("omit");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const payload = buildProductPayload(form, { barcodeMode: barcodePayloadMode });
    const requestBody = shouldIncludeBarcodeInJsonPayload(barcodePayloadMode)
      ? payload
      : Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== "barcode")
        );

    if (payload.name.length < 2) {
      setFieldErrors({ name: "Ürün adı en az 2 karakter olmalıdır." });
      setError("Ürün adı en az 2 karakter olmalıdır.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/products/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFieldErrors(mapProductFieldErrors(data.errors));
        setError(
          getFirstProductErrorMessage(data.message, data.errors) ||
            "Ürün oluşturulamadı."
        );
        return;
      }

      const productId = data.data?.id as string | undefined;
      router.push(productId ? `/products/${productId}?created=1` : "/products");
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const filledFields = Object.values(form).filter((value) => Boolean(value)).length;

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="products"
          title="Ürün kaydediliyor"
          subtitle="Ürün ve stok hareketi oluşturuluyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/products"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Yeni Ürün Kaydı
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  Ürün Bilgileri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Ürün, stok ve fiyat bilgilerini tek ekranda yönetin. Sadece
                  ürün adı zorunludur; diğer alanları ihtiyaca göre
                  doldurabilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopMiniCard
                label="Durum"
                value="Yeni Kayıt"
                icon={<Package size={17} />}
                color="rose"
              />
              <TopMiniCard
                label="Zorunlu Alan"
                value="Ürün Adı"
                icon={<CheckCircle2 size={17} />}
                color="emerald"
              />
              <TopMiniCard
                label="Doluluk"
                value={`${filledFields}/12 alan`}
                icon={<Boxes size={17} />}
                color="blue"
              />
            </div>
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
              mode="create"
              barcodePayloadMode={barcodePayloadMode}
              onBarcodePayloadModeChange={setBarcodePayloadMode}
              onChange={updateForm}
              onUnitTypeChange={(value: ProductUnitType) =>
                setForm((prev) => ({ ...prev, unitType: value }))
              }
              onStatusChange={(value) =>
                setForm((prev) => ({ ...prev, status: value }))
              }
              onProductTypeChange={handleProductTypeChange}
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
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-rose-500 to-pink-600 text-[13px] font-black text-white shadow-lg shadow-pink-100 transition hover:opacity-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={19} />
                )}
                {saving ? "Kaydediliyor..." : "Ürünü Kaydet"}
              </button>

              <Link
                href="/products"
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </Link>
            </div>
          </form>

          <ProductPreviewPanel form={form} />
        </section>
      </div>
    </main>
  );
}

function TopMiniCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  color: "emerald" | "blue" | "rose";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="flex min-w-[150px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
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
