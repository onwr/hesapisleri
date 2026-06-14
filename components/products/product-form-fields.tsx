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
  Sparkles,
  Tag,
  TurkishLira,
} from "lucide-react";
import { ProductCategorySelect } from "@/components/products/product-category-select";
import {
  calculateProductProfit,
  formatProfitMargin,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNIT_TYPES,
  type ProductFormValues,
  type ProductUnitType,
} from "@/lib/product-form-utils";

type ProductFormFieldsProps = {
  form: ProductFormValues;
  fieldErrors: Record<string, string>;
  mode: "create" | "edit";
  currentStock?: number;
  onChange: (key: keyof ProductFormValues, value: string) => void;
  onBatchChange?: (values: Partial<ProductFormValues>) => void;
  onUnitTypeChange: (value: ProductUnitType) => void;
  onStatusChange: (value: "ACTIVE" | "PASSIVE") => void;
};

export function ProductFormFields({
  form,
  fieldErrors,
  mode,
  currentStock,
  onChange,
  onBatchChange,
  onUnitTypeChange,
  onStatusChange,
}: ProductFormFieldsProps) {
  const [generatingIdentifiers, setGeneratingIdentifiers] = useState(false);
  const buyPrice = Number(form.buyPrice || 0);
  const sellPrice = Number(form.sellPrice || 0);
  const { profit, margin } = calculateProductProfit(buyPrice, sellPrice);

  async function generateIdentifiers(target?: "sku" | "barcode" | "both") {
    setGeneratingIdentifiers(true);

    try {
      const response = await fetch("/api/products/generate-identifiers");
      const data = await response.json();

      if (!response.ok || !data.success) {
        return;
      }

      const updates: Partial<ProductFormValues> = {};

      if (target === "sku" || target === "both" || !target) {
        updates.sku = data.data.sku as string;
      }

      if (target === "barcode" || target === "both" || !target) {
        updates.barcode = data.data.barcode as string;
      }

      if (target === "sku") {
        onChange("sku", updates.sku ?? form.sku);
      } else if (target === "barcode") {
        onChange("barcode", updates.barcode ?? form.barcode);
      } else if (onBatchChange) {
        onBatchChange(updates);
      } else {
        if (updates.sku) onChange("sku", updates.sku);
        if (updates.barcode) onChange("barcode", updates.barcode);
      }
    } finally {
      setGeneratingIdentifiers(false);
    }
  }

  return (
    <div className="space-y-5">
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
        title="Stok & Barkod"
        description="Stok kodu, barkod, stok miktarı ve depo bilgileri."
        icon={<Boxes size={20} strokeWidth={2.4} />}
        iconClass="bg-orange-50 text-orange-600"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <IdentifierField
            label="SKU / Stok Kodu"
            icon={<Tag size={18} />}
            value={form.sku}
            onChange={(value) => onChange("sku", value)}
            placeholder="Opsiyonel"
            error={fieldErrors.sku}
            generating={generatingIdentifiers}
            onGenerate={() => void generateIdentifiers("sku")}
          />

          <IdentifierField
            label="Barkod"
            icon={<Barcode size={18} />}
            value={form.barcode}
            onChange={(value) => onChange("barcode", value)}
            placeholder="869..."
            error={fieldErrors.barcode}
            generating={generatingIdentifiers}
            onGenerate={() => void generateIdentifiers("barcode")}
          />

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => void generateIdentifiers("both")}
              disabled={generatingIdentifiers}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 text-[12px] font-black text-blue-600 transition hover:bg-blue-100 disabled:opacity-60"
            >
              {generatingIdentifiers ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Sparkles size={15} />
              )}
              SKU ve Barkod Otomatik Oluştur
            </button>
          </div>
          {mode === "create" ? (
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
            <ReadonlyField
              label="Mevcut Stok"
              icon={<Boxes size={18} />}
              value={String(currentStock ?? 0)}
              hint="Stok değişimi için Stok modülünü kullanın."
            />
          )}

          <InputField
            label="Kritik Stok Seviyesi"
            type="number"
            icon={<Scale size={18} />}
            value={form.minStock}
            onChange={(value) => onChange("minStock", value)}
            placeholder="10"
            error={fieldErrors.minStock}
          />

          <SelectField
            label="Birim Tipi"
            icon={<Scale size={18} />}
            value={form.unitType}
            onChange={(value) => onUnitTypeChange(value as ProductUnitType)}
            options={PRODUCT_UNIT_TYPES.map((unit) => ({
              value: unit,
              label: PRODUCT_UNIT_LABELS[unit],
            }))}
          />

          <InputField
            label="Raf / Depo Konumu"
            icon={<MapPin size={18} />}
            value={form.warehouseLocation}
            onChange={(value) => onChange("warehouseLocation", value)}
            placeholder="A-12, Depo 1..."
            error={fieldErrors.warehouseLocation}
          />
        </div>
      </FormSection>

      <FormSection
        title="Fiyatlandırma"
        description="Alış ve satış fiyatlarını girin; kâr otomatik hesaplanır."
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
          />

          <InputField
            label="Satış Fiyatı"
            inputMode="decimal"
            icon={<TurkishLira size={18} />}
            value={form.sellPrice}
            onChange={(value) => onChange("sellPrice", value)}
            placeholder="0"
            error={fieldErrors.sellPrice}
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
  onGenerate,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  error?: string;
  generating?: boolean;
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
          ) : (
            <Sparkles size={12} />
          )}
          Oluştur
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
