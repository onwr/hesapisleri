"use client";

import { ChevronDown, Warehouse, X } from "lucide-react";

export type WarehouseSelectOption = {
  id: string;
  name: string;
  code?: string | null;
  isDefault?: boolean;
};

type WarehouseSelectFieldProps = {
  label?: string;
  warehouses: WarehouseSelectOption[];
  value: string;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  className?: string;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  inactiveHint?: string;
};

export function WarehouseSelectField({
  label = "Satış Deposu",
  warehouses,
  value,
  onChange,
  disabled = false,
  className = "",
  enabled = true,
  onEnabledChange,
  inactiveHint = "Toplam stok gösterilir; satışta varsayılan depodan düşülür.",
}: WarehouseSelectFieldProps) {
  const isOptional = Boolean(onEnabledChange);

  if (isOptional && !enabled) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => onEnabledChange?.(true)}
          disabled={disabled || warehouses.length === 0}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 text-left transition hover:border-blue-200 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Warehouse size={14} className="shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="block text-[12px] font-black text-[#24345f]">
                Depo seç (opsiyonel)
              </span>
              <span className="block truncate text-[11px] font-semibold text-slate-500">
                {inactiveHint}
              </span>
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[12px] font-black text-[#24345f]">
          <Warehouse size={14} />
          {label}
        </label>

        {isOptional ? (
          <button
            type="button"
            onClick={() => onEnabledChange?.(false)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
          >
            <X size={12} />
            Kapat
          </button>
        ) : null}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || warehouses.length === 0}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
      >
        {warehouses.length === 0 ? (
          <option value="">Depo bulunamadı</option>
        ) : null}

        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouse.name}
            {warehouse.isDefault ? " (Varsayılan)" : ""}
            {warehouse.code ? ` · ${warehouse.code}` : ""}
          </option>
        ))}
      </select>

      {isOptional ? (
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Seçili depodan stok gösterilir ve satış düşümü yapılır.
        </p>
      ) : null}
    </div>
  );
}
