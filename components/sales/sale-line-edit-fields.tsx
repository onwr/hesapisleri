"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isSaleVatPreset,
  SALE_VAT_PRESETS,
} from "@/lib/sale-calculation-utils";

type SaleLineEditFieldsProps = {
  unitPrice: number;
  vatRate: number;
  onUnitPriceChange: (value: number) => void;
  onVatRateChange: (value: number) => void;
  compact?: boolean;
  priceInputId?: string;
};

export function SaleLineEditFields({
  unitPrice,
  vatRate,
  onUnitPriceChange,
  onVatRateChange,
  compact = false,
  priceInputId,
}: SaleLineEditFieldsProps) {
  const [unitPriceInput, setUnitPriceInput] = useState(String(unitPrice));
  const [customVat, setCustomVat] = useState(!isSaleVatPreset(vatRate));

  useEffect(() => {
    setUnitPriceInput(String(unitPrice));
  }, [unitPrice]);

  useEffect(() => {
    setCustomVat(!isSaleVatPreset(vatRate));
  }, [vatRate]);

  const vatSelectValue = useMemo(() => {
    if (customVat || !isSaleVatPreset(vatRate)) return "custom";
    return String(vatRate);
  }, [customVat, vatRate]);

  function commitUnitPrice(raw: string) {
    setUnitPriceInput(raw);
    const normalized = raw.replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onUnitPriceChange(parsed);
  }

  return (
    <div
      className={[
        "grid gap-2",
        compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
      ].join(" ")}
    >
      <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        Birim Fiyat
        <input
          id={priceInputId}
          value={unitPriceInput}
          onChange={(event) => commitUnitPrice(event.target.value)}
          onBlur={() => setUnitPriceInput(String(unitPrice))}
          inputMode="decimal"
          title="Bu değişiklik ürün kartındaki satış fiyatını değiştirmez."
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
        />
      </label>

      <label className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        KDV
        <div className="mt-1 space-y-1">
          <select
            value={vatSelectValue}
            onChange={(event) => {
              if (event.target.value === "custom") {
                setCustomVat(true);
                return;
              }

              setCustomVat(false);
              onVatRateChange(Number(event.target.value));
            }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
          >
            {SALE_VAT_PRESETS.map((rate) => (
              <option key={rate} value={rate}>
                %{rate}
              </option>
            ))}
            <option value="custom">Özel oran</option>
          </select>

          {vatSelectValue === "custom" ? (
            <input
              value={vatRate}
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(",", "."));
                if (!Number.isFinite(parsed)) return;
                onVatRateChange(parsed);
              }}
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Özel KDV %"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-bold text-[#0f1f4d] outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-50"
            />
          ) : null}
        </div>
      </label>
    </div>
  );
}
