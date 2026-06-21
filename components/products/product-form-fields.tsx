"use client";

import type { ReactNode } from "react";
import { PRODUCT_FORM_SECTION_CLASS } from "@/components/products/product-ui-tokens";
import { useState } from "react";
import {
  Barcode,
  Boxes,
  FileText,
  Loader2,
  MapPin,
  Package,
  Scale,
  ShieldCheck,
  Tag,
  Trash2,
  TurkishLira,
} from "lucide-react";
import { ProductCategorySelect } from "@/components/products/product-category-select";
import {
  calculateProductProfit,
  formatProfitMargin,
  getUnitTypesForProductType,
  PRODUCT_UNIT_LABELS,
  type ProductBarcodePayloadMode,
  type ProductFormValues,
  type ProductUnitType,
} from "@/lib/product-form-utils";
import {
  PRODUCT_TYPE_DESCRIPTIONS,
  PRODUCT_TYPE_LABELS,
  type ProductTypeKey,
} from "@/lib/product-type-utils";

type ProductFormFieldsProps = {
  form: ProductFormValues;
  fieldErrors: Record<string, string>;
  mode: "create" | "edit";
  currentStock?: number;
  barcodePayloadMode: ProductBarcodePayloadMode;
  onBarcodePayloadModeChange: (mode: ProductBarcodePayloadMode) => void;
  onChange: (key: keyof ProductFormValues, value: string) => void;
  onUnitTypeChange: (value: ProductUnitType) => void;
  onStatusChange: (value: "ACTIVE" | "PASSIVE") => void;
  onProductTypeChange?: (value: ProductTypeKey) => void;
};

export function ProductFormFields({
  form,
  fieldErrors,
  mode,
  currentStock,
  barcodePayloadMode,
  onBarcodePayloadModeChange,
  onChange,
  onUnitTypeChange,
  onStatusChange,
  onProductTypeChange,
}: ProductFormFieldsProps) {
  const [generatingSku, setGeneratingSku] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const isService = form.productType === "SERVICE";
  const unitTypes = getUnitTypesForProductType(form.productType);
  const barcodeEnabled = barcodePayloadMode === "include" || barcodePayloadMode === "clear";
  const buyPrice = Number(form.buyPrice || 0);
  const sellPrice = Number(form.sellPrice || 0);
  const { profit, margin } = calculateProductProfit(buyPrice, sellPrice);

  async function generateSku() {
    setGeneratingSku(true);

    try {
      const response = await fetch("/api/products/generate-identifiers?field=sku");
      const data = await response.json();

      if (!response.ok || !data.success) {
        return;
      }

      onChange("sku", data.data.sku as string);
    } finally {
      setGeneratingSku(false);
    }
  }

  async function generateBarcode() {
    setGeneratingBarcode(true);

    try {
      const response = await fetch("/api/products/generate-barcode", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        return;
      }

      onChange("barcode", data.barcode as string);
      if (barcodePayloadMode !== "include") {
        onBarcodePayloadModeChange("include");
      }
    } finally {
      setGeneratingBarcode(false);
    }
  }

  function handleBarcodeToggle(enabled: boolean) {
    if (enabled) {
      onBarcodePayloadModeChange("include");
      return;
    }

    if (mode === "edit" && form.barcode.trim()) {
      onBarcodePayloadModeChange("omit");
      return;
    }

    onBarcodePayloadModeChange("omit");
    onChange("barcode", "");
  }

  function handleRemoveBarcode() {
    onChange("barcode", "");
    onBarcodePayloadModeChange("clear");
  }

  return (
    <div className="space-y-5">
      <FormSection
        title="Kalem Türü"
        description="Stoklu ürün veya stoksuz hizmet kalemi seçin."
        icon={<Package size={20} strokeWidth={2.4} />}
        iconClass="bg-indigo-50 text-indigo-600"
      >
        {mode === "edit" ? (
          <ReadonlyField
            label="Kalem Türü"
            icon={<Package size={18} />}
            value={PRODUCT_TYPE_LABELS[form.productType]}
            hint="Kalem türü oluşturulduktan sonra değiştirilemez."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(["STOCK", "SERVICE"] as const).map((type) => {
              const selected = form.productType === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onProductTypeChange?.(type)}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-blue-200 bg-blue-50/60 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300",
                  ].join(" ")}
                >
                  <p className="text-[13px] font-black text-[#0f1f4d]">
                    {PRODUCT_TYPE_LABELS[type]}
                  </p>
                  <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500">
                    {PRODUCT_TYPE_DESCRIPTIONS[type]}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </FormSection>

      <FormSection
        title="Temel Bilgiler"
        description="Ürün adı, kategori, açıklama ve görsel bilgileri."
        icon={<Package size={20} strokeWidth={2.4} />}
        iconClass="bg-blue-50 text-blue-600"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <InputField
              label="Ürün Adı"
              required
              icon={<Package size={18} />}
              value={form.name}
              onChange={(value) => onChange("name", value)}
              placeholder="Örnek Ürün"
              error={fieldErrors.name}
            />
          </div>

          <ProductCategorySelect
            value={form.categoryName}
            onChange={(value) => onChange("categoryName", value)}
            error={fieldErrors.categoryName}
          />

          <div className="md:col-span-2">
            <label className="text-[12px] font-black text-[#24345f]">
              Açıklama
            </label>
            <div className="relative mt-2">
              <FileText
                size={18}
                className="absolute left-4 top-4 text-slate-400"
              />
              <textarea
                value={form.description}
                onChange={(event) => onChange("description", event.target.value)}
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                placeholder="Ürün açıklaması"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection
        title={isService ? "Kod Bilgileri" : "Stok & Barkod"}
        description={
          isService
            ? "Hizmet kodu ve birim bilgileri."
            : "Stok kodu, barkod, stok miktarı ve depo bilgileri."
        }
        icon={<Boxes size={20} strokeWidth={2.4} />}
        iconClass="bg-orange-50 text-orange-600"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <IdentifierField
            label={isService ? "SKU / Hizmet Kodu" : "SKU / Stok Kodu"}
            icon={<Tag size={18} />}
            value={form.sku}
            onChange={(value) => onChange("sku", value)}
            placeholder="Opsiyonel"
            error={fieldErrors.sku}
            generating={generatingSku}
            generateLabel="Oluştur"
            onGenerate={() => void generateSku()}
          />

          {!isService ? (
          <div className="md:col-span-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={barcodeEnabled}
                onChange={(event) => handleBarcodeToggle(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-[13px] font-black text-[#0f1f4d]">
                  Barkod bilgisi ekle
                </span>
                <span className="mt-1 block text-[11px] font-medium leading-5 text-slate-500">
                  Barkodu kendiniz girebilir veya otomatik oluşturabilirsiniz.
                </span>
              </span>
            </label>

            {barcodeEnabled ? (
              <div className="mt-4 space-y-3">
                <IdentifierField
                  label="Barkod"
                  icon={<Barcode size={18} />}
                  value={form.barcode}
                  onChange={(value) => {
                    onChange("barcode", value);
                    if (barcodePayloadMode === "clear") {
                      onBarcodePayloadModeChange("include");
                    }
                  }}
                  placeholder="Barkod girin veya otomatik oluşturun"
                  error={fieldErrors.barcode}
                  generating={generatingBarcode}
                  generateLabel="Otomatik Oluştur"
                  onGenerate={() => void generateBarcode()}
                />

                {mode === "edit" && form.barcode.trim() ? (
                  <button
                    type="button"
                    onClick={handleRemoveBarcode}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-100 bg-white px-3 text-[11px] font-black text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                    Barkodu Kaldır
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {!isService && mode === "create" ? (
            <InputField
              label="Stok Miktarı"
              type="number"
              icon={<Boxes size={18} />}
              value={form.stock}
              onChange={(value) => onChange("stock", value)}
              placeholder="0"
              error={fieldErrors.stock}
            />
          ) : (
            !isService ? (
            <ReadonlyField
              label="Mevcut Stok"
              icon={<Boxes size={18} />}
              value={String(currentStock ?? 0)}
              hint="Stok değişimi için Stok modülünü kullanın."
            />
            ) : null
          )}

          {!isService ? (
          <InputField
            label="Kritik Stok Seviyesi"
            type="number"
            icon={<Scale size={18} />}
            value={form.minStock}
            onChange={(value) => onChange("minStock", value)}
            placeholder="10"
            error={fieldErrors.minStock}
          />
          ) : null}

          <SelectField
            label="Birim Tipi"
            icon={<Scale size={18} />}
            value={form.unitType}
            onChange={(value) => onUnitTypeChange(value as ProductUnitType)}
            options={unitTypes.map((unit) => ({
              value: unit,
              label: PRODUCT_UNIT_LABELS[unit],
            }))}
          />

          {!isService ? (
          <InputField
            label="Raf / Depo Konumu"
            icon={<MapPin size={18} />}
            value={form.warehouseLocation}
            onChange={(value) => onChange("warehouseLocation", value)}
            placeholder="A-12, Depo 1..."
            error={fieldErrors.warehouseLocation}
          />
          ) : null}
        </div>
      </FormSection>

      <FormSection
        title="Fiyat Bilgileri"
        description="Alış fiyatı stok değerinde, satış fiyatı satış işlemlerinde kullanılır."
        icon={<TurkishLira size={20} strokeWidth={2.4} />}
        iconClass="bg-emerald-50 text-emerald-600"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Alış Fiyatı"
            inputMode="decimal"
            icon={<TurkishLira size={18} />}
            value={form.buyPrice}
            onChange={(value) => onChange("buyPrice", value)}
            placeholder="0"
            error={fieldErrors.buyPrice}
            hint="Stok değeri ve maliyet hesaplarında kullanılır."
          />

          <InputField
            label="Satış Fiyatı"
            inputMode="decimal"
            icon={<TurkishLira size={18} />}
            value={form.sellPrice}
            onChange={(value) => onChange("sellPrice", value)}
            placeholder="0"
            error={fieldErrors.sellPrice}
            hint="Satış, POS, fatura ve tekliflerde kullanılır."
          />

          <SelectField
            label="KDV Oranı"
            icon={<TurkishLira size={18} />}
            value={form.vatRate}
            onChange={(value) => onChange("vatRate", value)}
            options={[
              { value: "0", label: "%0" },
              { value: "1", label: "%1" },
              { value: "10", label: "%10" },
              { value: "20", label: "%20" },
            ]}
          />

          <ReadonlyField
            label="Kâr Marjı"
            icon={<TurkishLira size={18} />}
            value={formatProfitMargin(margin)}
            hint="Alış fiyatına göre otomatik hesaplanır."
          />

          <ReadonlyField
            label="Kâr Tutarı"
            icon={<TurkishLira size={18} />}
            value={new Intl.NumberFormat("tr-TR", {
              style: "currency",
              currency: "TRY",
              maximumFractionDigits: 2,
            }).format(profit)}
            hint="Satış fiyatı - alış fiyatı"
          />
        </div>
      </FormSection>

      <FormSection
        title="Durum"
        description="Ürünün satış ve POS görünürlük durumu."
        icon={<ShieldCheck size={20} strokeWidth={2.4} />}
        iconClass="bg-violet-50 text-violet-600"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Durum"
            icon={<ShieldCheck size={18} />}
            value={form.status}
            onChange={(value) => onStatusChange(value as "ACTIVE" | "PASSIVE")}
            options={[
              { value: "ACTIVE", label: "Aktif" },
              { value: "PASSIVE", label: "Pasif" },
            ]}
          />

          <ReadonlyField
            label="POS Görünürlüğü"
            icon={<ShieldCheck size={18} />}
            value={form.status === "ACTIVE" ? "POS'ta gösteriliyor" : "POS'ta gizli"}
            hint="Aktif ürünler POS ekranında listelenir."
          />
        </div>
      </FormSection>
    </div>
  );
}

function FormSection({
  title,
  description,
  icon,
  iconClass,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <section className={PRODUCT_FORM_SECTION_CLASS}>
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              iconClass,
            ].join(" ")}
          >
            {icon}
          </div>

          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">{title}</h2>
            <p className="text-[12px] font-medium text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

function IdentifierField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  error,
  generating,
  generateLabel,
  onGenerate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  error?: string;
  generating?: boolean;
  generateLabel: string;
  onGenerate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[12px] font-black text-[#24345f]">{label}</label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:underline disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="animate-spin" size={12} />
          ) : null}
          {generateLabel}
        </button>
      </div>

      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={[
            "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
            error
              ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
              : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
          ].join(" ")}
          placeholder={placeholder}
        />
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  inputMode,
  required = false,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  type?: string;
  inputMode?: "decimal" | "numeric" | "text";
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>

      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={required ? 2 : undefined}
          type={type}
          inputMode={inputMode}
          min={type === "number" ? 0 : undefined}
          className={[
            "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
            error
              ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
              : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
          ].join(" ")}
          placeholder={placeholder}
        />
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-[11px] font-medium text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>

      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[13px] font-bold text-[#0f1f4d] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ReadonlyField({
  label,
  icon,
  value,
  hint,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>

      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <div className="flex h-12 items-center rounded-2xl border border-slate-100 bg-slate-50 pl-11 pr-4 text-[13px] font-black text-[#0f1f4d]">
          {value}
        </div>
      </div>

      {hint ? (
        <p className="mt-2 text-[11px] font-medium text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
