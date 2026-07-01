"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  ClipboardList,
  Loader2,
  MapPin,
  Save,
  Sparkles,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { ProductStockSummaryPanel } from "@/components/products/product-stock-summary-panel";
import { DEFAULT_CATEGORY_NAME, PRODUCT_UNIT_LABELS, type ProductUnitType } from "@/lib/product-form-utils";
import {
  calculateStockMovement,
  getFirstStockMovementErrorMessage,
  getQuantityFieldHint,
  getQuantityFieldLabel,
  mapStockMovementFieldErrors,
  STOCK_MOVEMENT_REQUEST_TYPES,
  STOCK_MOVEMENT_TYPE_LABELS,
  toDateTimeLocalValue,
  type StockMovementRequestType,
} from "@/lib/stock-movement-utils";

type WarehouseOption = {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
};

type ProductStockMovementFormProps = {
  product: {
    id: string;
    name: string;
    stock: number;
    minStock: number;
    unitType: ProductUnitType;
    warehouseLocation: string | null;
    category?: { name: string } | null;
  };
  warehouses: WarehouseOption[];
  warehouseStocks: { warehouseId: string; quantity: number }[];
};

export function ProductStockMovementForm({
  product,
  warehouses,
  warehouseStocks,
}: ProductStockMovementFormProps) {
  const router = useRouter();
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [movementType, setMovementType] =
    useState<StockMovementRequestType>("IN");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const defaultWarehouse =
    warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse?.id ?? "");
  const [warehouseLocation, setWarehouseLocation] = useState(
    product.warehouseLocation ?? ""
  );
  const [movementDate, setMovementDate] = useState(() => toDateTimeLocalValue());

  const selectedWarehouseStock = useMemo(() => {
    const entry = warehouseStocks.find((s) => s.warehouseId === warehouseId);
    return entry?.quantity ?? 0;
  }, [warehouseId, warehouseStocks]);

  const unitLabel = PRODUCT_UNIT_LABELS[product.unitType] ?? "Adet";
  const categoryName = product.category?.name ?? DEFAULT_CATEGORY_NAME;

  const previewError = useMemo(() => {
    if (!quantity.trim()) return "";

    const parsed = Number(quantity);
    if (Number.isNaN(parsed)) {
      return "Geçerli bir miktar girin.";
    }

    const result = calculateStockMovement(
      movementType,
      selectedWarehouseStock,
      parsed
    );
    return "error" in result ? result.error : "";
  }, [movementType, selectedWarehouseStock, quantity]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    const parsedQuantity = Number(quantity);
    if (quantity.trim() === "" || Number.isNaN(parsedQuantity)) {
      setFieldErrors({ quantity: "Geçerli bir miktar girin." });
      setError("Geçerli bir miktar girin.");
      return;
    }

    const localCheck = calculateStockMovement(
      movementType,
      selectedWarehouseStock,
      parsedQuantity
    );

    if ("error" in localCheck) {
      setFieldErrors({ quantity: localCheck.error });
      setError(localCheck.error);
      return;
    }

    const result = await mutate(`/api/products/${product.id}/stock-movement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: movementType,
        quantity: parsedQuantity,
        warehouseId: warehouseId || undefined,
        note: note.trim() || undefined,
        warehouseLocation: warehouseLocation.trim() || undefined,
        movementDate,
      }),
    });

    if (!result.ok) {
      if (result.error === "duplicate_submit") return;
      if ("errors" in result && result.errors) {
        setFieldErrors(mapStockMovementFieldErrors(result.errors));
      }
      setError(
        getFirstStockMovementErrorMessage(
          result.error === "duplicate_submit" ? undefined : result.error,
          "errors" in result ? result.errors : undefined
        ) || "Stok hareketi kaydedilemedi."
      );
      return;
    }

    router.push(`/products/${product.id}?stockUpdated=1`);
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {isSubmitting ? (
        <AppLoadingScreen
          preset="products"
          title="Stok hareketi kaydediliyor"
          subtitle="Stok güncelleniyor..."
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
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Stok Hareketi
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  {product.name}
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Stok girişi, çıkışı, düzeltme veya sayım işlemini kaydedin.
                  Toplam stok: {product.stock} {unitLabel}.
                  Seçili depo: {selectedWarehouseStock} {unitLabel}.
                </p>
              </div>
            </div>

            <TopMiniCard
              label="Mevcut Stok"
              value={`${product.stock} ${unitLabel}`}
              icon={<Boxes size={17} />}
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                    <ClipboardList size={20} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Hareket Bilgileri
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      İşlem tipini seçin ve hareket detaylarını girin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Hareket Tipi
                  </label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {STOCK_MOVEMENT_REQUEST_TYPES.map((type) => {
                      const selected = movementType === type;
                      const Icon =
                        type === "IN"
                          ? ArrowDownLeft
                          : type === "OUT"
                            ? ArrowUpRight
                            : ClipboardList;

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setMovementType(type)}
                          className={[
                            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                            selected
                              ? "border-orange-300 bg-orange-50 ring-4 ring-orange-50"
                              : "border-slate-200 bg-white hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              selected
                                ? "bg-orange-500 text-white"
                                : "bg-slate-100 text-slate-600",
                            ].join(" ")}
                          >
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="text-[13px] font-black text-[#0f1f4d]">
                              {STOCK_MOVEMENT_TYPE_LABELS[type]}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                              {type}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Depo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                        {warehouse.isDefault ? " (Varsayılan)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label={getQuantityFieldLabel(movementType)}
                  required
                  type="number"
                  step={movementType === "ADJUSTMENT" ? "any" : "1"}
                  min={movementType === "COUNT" ? "0" : undefined}
                  value={quantity}
                  onChange={setQuantity}
                  placeholder={
                    movementType === "COUNT"
                      ? String(product.stock)
                      : "0"
                  }
                  hint={getQuantityFieldHint(movementType)}
                  error={fieldErrors.quantity}
                  suffix={unitLabel}
                />

                <InputField
                  label="İşlem Tarihi"
                  required
                  type="datetime-local"
                  value={movementDate}
                  onChange={setMovementDate}
                  error={fieldErrors.movementDate}
                />

                <div>
                  <label className="text-[12px] font-black text-[#24345f]">
                    Açıklama / Not
                  </label>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
                    placeholder="Opsiyonel açıklama"
                  />
                </div>

                <InputField
                  label="Depo / Raf Konumu"
                  value={warehouseLocation}
                  onChange={setWarehouseLocation}
                  placeholder="Opsiyonel"
                  icon={<MapPin size={18} />}
                />
              </div>
            </section>

            {previewError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-700">
                {previewError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSubmitting || Boolean(previewError)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-orange-500 to-amber-600 text-[13px] font-black text-white shadow-lg shadow-orange-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Save size={19} />
                )}
                {isSubmitting ? "Kaydediliyor..." : "Stok Hareketini Kaydet"}
              </button>

              <Link
                href={`/products/${product.id}`}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-slate-600 hover:bg-slate-50"
              >
                Vazgeç
              </Link>
            </div>
          </form>

          <ProductStockSummaryPanel
            product={{
              name: product.name,
              stock: product.stock,
              minStock: product.minStock,
              unitLabel,
              categoryName,
            }}
            movementType={movementType}
            quantityInput={quantity}
          />
        </section>
      </div>
    </main>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  required = false,
  error,
  hint,
  suffix,
  step,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  type?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  suffix?: string;
  step?: string;
  min?: string;
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

      <div className="relative mt-2">
        {icon ? (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        ) : type === "datetime-local" ? (
          <CalendarClock
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
        ) : null}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={type}
          step={step}
          min={min}
          className={[
            "h-12 w-full rounded-2xl border bg-white pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
            icon || type === "datetime-local" ? "pl-11" : "pl-4",
            suffix ? "pr-16" : "",
            error
              ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
              : "border-slate-200 focus:border-orange-200 focus:ring-orange-50",
          ].join(" ")}
          placeholder={placeholder}
        />

        {suffix ? (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-black text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
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
