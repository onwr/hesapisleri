"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";
import {
  isProductMappingImportEmptyResult,
  type ProductMappingImportItem,
} from "@/lib/marketplace/marketplace-product-mapping-import-utils";
import { IntegrationChannelLogo } from "@/components/settings/integrations/integration-channel-logo";
import { CHANNEL_UI_CONFIG } from "@/components/settings/integrations/integration-ui-config";

export type ProductMappingImportResultData = {
  fetched: number;
  mapped: number;
  alreadyMapped: number;
  unmatched: number;
  skipped: number;
  conflicts: number;
  items: {
    mapped: ProductMappingImportItem[];
    unmatched: ProductMappingImportItem[];
    conflicts: ProductMappingImportItem[];
    skipped?: ProductMappingImportItem[];
  };
  errors?: Array<{ message: string; page?: number }>;
};

type ProductMappingImportResultModalProps = {
  channel: MarketplaceChannelKey;
  result: ProductMappingImportResultData | null;
  onClose: () => void;
};

function ImportItemList({
  title,
  items,
  tone,
  limit = 20,
}: {
  title: string;
  items: ProductMappingImportItem[];
  tone: "emerald" | "amber" | "rose" | "slate";
  limit?: number;
}) {
  if (items.length === 0) return null;

  const toneClass =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-950"
      : tone === "amber"
        ? "border-amber-100 bg-amber-50/70 text-amber-950"
        : tone === "rose"
          ? "border-rose-100 bg-rose-50/70 text-rose-950"
          : "border-slate-200 bg-slate-50/80 text-slate-800";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-black">{title}</p>
      <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto text-xs font-semibold">
        {items.slice(0, limit).map((item, index) => (
          <li key={`${item.merchantSku}-${item.productId ?? "none"}-${index}`}>
            {item.merchantSku || "—"}
            {item.barcode ? ` · ${item.barcode}` : ""}
            {item.title ? ` · ${item.title}` : ""}
            {item.productName ? ` → ${item.productName}` : ""}
            {item.reason ? ` (${item.reason})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductMappingImportResultModal({
  channel,
  result,
  onClose,
}: ProductMappingImportResultModalProps) {
  if (!result) return null;

  const config = CHANNEL_UI_CONFIG[channel];
  const hasErrors = (result.errors?.length ?? 0) > 0;
  const isEmpty = isProductMappingImportEmptyResult(result);
  const skippedItems = result.items.skipped ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="relative">
            <IntegrationChannelLogo channel={channel} size="md" className="h-12 w-12" />
            <div
              className={[
                "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white",
                hasErrors
                  ? "bg-amber-100 text-amber-700"
                  : isEmpty
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700",
              ].join(" ")}
            >
              {hasErrors ? (
                <AlertTriangle size={11} />
              ) : isEmpty ? (
                <Info size={11} />
              ) : (
                <CheckCircle2 size={11} />
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
              {config.title}
            </p>
            <h3 className="text-lg font-black text-slate-950">
              {isEmpty
                ? "Bağlantı başarılı, ürün/listing bulunamadı"
                : "SKU Eşleme Import Tamamlandı"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isEmpty
                ? "Pazaryeri bağlantısı çalışıyor ancak ürün eşleme importu için bu kanaldan listing dönmedi. Bu durum yeni ürün oluşturulmadığı veya sipariş çekilmediği anlamına gelmez."
                : "Bu işlem yeni ürün oluşturmaz. Sadece pazaryerindeki merchant SKU / barkod değerlerini mevcut panel ürünlerinizle eşleştirir."}
            </p>
          </div>
        </div>

        {isEmpty ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-950">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              Panel ürünlerinizin SKU/barkod alanlarını kontrol edin. Trendyol
              mağazanızda onaylı listing yoksa veya merchant SKU dönmediyse tüm
              değerler 0 görünebilir.
            </span>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Çekilen listing", value: result.fetched },
            { label: "Eşlenen", value: result.mapped },
            { label: "Zaten eşli", value: result.alreadyMapped },
            { label: "Eşleşmeyen", value: result.unmatched },
            { label: "Atlanan", value: result.skipped },
            { label: "Çakışan", value: result.conflicts },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-center"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <ImportItemList
            title="Yeni eşlenenler"
            items={result.items.mapped}
            tone="emerald"
          />
          <ImportItemList
            title="Eşleşmeyenler"
            items={result.items.unmatched}
            tone="amber"
          />
          <ImportItemList
            title="Atlanan kayıtlar"
            items={skippedItems}
            tone="slate"
            limit={10}
          />
          <ImportItemList
            title="Çakışan kayıtlar"
            items={result.items.conflicts}
            tone="rose"
          />
        </div>

        {hasErrors ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <p className="text-xs font-black text-rose-700">API uyarıları</p>
            <ul className="mt-2 space-y-1 text-xs font-semibold text-rose-800">
              {result.errors?.slice(0, 3).map((item, index) => (
                <li key={index}>• {item.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
          >
            Kapat
          </button>
          {result.items.unmatched.length > 0 ? (
            <Link
              href={config.mappingHref}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
            >
              Eşleşmeyenleri Gör
            </Link>
          ) : null}
          <Link
            href={config.mappingHref}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"
          >
            SKU Eşleme Sayfasına Git
          </Link>
          <Link
            href="/products"
            className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-4 text-xs font-black text-white"
          >
            Ürünlere Git
          </Link>
        </div>
      </div>
    </div>
  );
}
