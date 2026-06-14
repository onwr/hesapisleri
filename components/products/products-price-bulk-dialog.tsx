"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Percent, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductsPriceBulkDialogProps = {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (input: {
    priceField: "sell" | "buy" | "both";
    direction: "increase" | "decrease";
    mode: "percent" | "fixed";
    value: number;
  }) => void;
  isPending?: boolean;
};

export function ProductsPriceBulkDialog({
  open,
  selectedCount,
  onClose,
  onApply,
  isPending = false,
}: ProductsPriceBulkDialogProps) {
  const [priceField, setPriceField] = useState<"sell" | "buy" | "both">("sell");
  const [direction, setDirection] = useState<"increase" | "decrease">(
    "increase"
  );
  const [mode, setMode] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");

  useEffect(() => {
    if (open) {
      setPriceField("sell");
      setDirection("increase");
      setMode("percent");
      setValue("10");
    }
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) return;

    onApply({ priceField, direction, mode, value: parsed });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-black text-[#0f1f4d]">
              Toplu fiyat güncelle
            </DialogTitle>
            <DialogDescription>
              {selectedCount} seçili ürünün fiyatı güncellenecek.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-[12px] font-black text-[#24345f]">
                Fiyat alanı
              </label>
              <select
                value={priceField}
                onChange={(e) =>
                  setPriceField(e.target.value as "sell" | "buy" | "both")
                }
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
              >
                <option value="sell">Satış fiyatı</option>
                <option value="buy">Alış fiyatı</option>
                <option value="both">Alış + satış</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection("increase")}
                className={[
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-black",
                  direction === "increase"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                <TrendingUp size={14} />
                Artır
              </button>
              <button
                type="button"
                onClick={() => setDirection("decrease")}
                className={[
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-black",
                  direction === "decrease"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                <TrendingDown size={14} />
                Azalt
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("percent")}
                className={[
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-black",
                  mode === "percent"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                <Percent size={14} />
                Yüzde
              </button>
              <button
                type="button"
                onClick={() => setMode("fixed")}
                className={[
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-[12px] font-black",
                  mode === "fixed"
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                ₺ Sabit
              </button>
            </div>

            <div>
              <label className="text-[12px] font-black text-[#24345f]">
                {mode === "percent" ? "Yüzde değeri" : "Tutar (₺)"}
              </label>
              <input
                type="number"
                min="0"
                step={mode === "percent" ? "0.1" : "0.01"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-[13px] font-medium"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Uygulanıyor..." : "Fiyatları güncelle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
