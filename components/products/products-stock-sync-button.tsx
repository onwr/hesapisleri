"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type ProductsStockSyncButtonProps = {
  canSync: boolean;
  compact?: boolean;
};

export function ProductsStockSyncButton({
  canSync,
  compact = false,
}: ProductsStockSyncButtonProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [message, setMessage] = useState<string | null>(null);

  if (!canSync) return null;

  async function handleSync() {
    setMessage(null);

    const result = await mutate("/api/products/sync-stock", {
      method: "POST",
    });

    if (!result.ok) {
      setMessage(result.error ?? "Stok senkronizasyonu başarısız.");
      return;
    }

    setMessage("Stoklar senkronlandı.");
  }

  const buttonClass = compact
    ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-60"
    : "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className={compact ? "relative" : "flex flex-col items-end gap-1"}>
      <button
        type="button"
        onClick={() => void handleSync()}
        disabled={isSubmitting}
        className={buttonClass}
        title={message ?? undefined}
      >
        <RefreshCw size={compact ? 14 : 16} className={isSubmitting ? "animate-spin" : ""} />
        {isSubmitting ? "Senkronlanıyor..." : "Stokları Senkronla"}
      </button>
      {message && !compact ? (
        <p className="max-w-xs text-right text-[11px] font-semibold text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
