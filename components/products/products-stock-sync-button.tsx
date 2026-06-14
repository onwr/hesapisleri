"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

type ProductsStockSyncButtonProps = {
  canSync: boolean;
  compact?: boolean;
};

export function ProductsStockSyncButton({
  canSync,
  compact = false,
}: ProductsStockSyncButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!canSync) return null;

  function handleSync() {
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/products/sync-stock", {
          method: "POST",
        });
        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
          updated?: number;
          unchanged?: number;
        };

        if (!response.ok || !result.success) {
          setMessage(result.message ?? "Stok senkronizasyonu başarısız.");
          return;
        }

        setMessage(result.message ?? "Stoklar senkronlandı.");
        router.refresh();
      } catch {
        setMessage("Stok senkronizasyonu sırasında bir hata oluştu.");
      }
    });
  }

  const buttonClass = compact
    ? "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-60"
    : "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <div className={compact ? "relative" : "flex flex-col items-end gap-1"}>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className={buttonClass}
        title={message ?? undefined}
      >
        <RefreshCw size={compact ? 14 : 16} className={isPending ? "animate-spin" : ""} />
        {isPending ? "Senkronlanıyor..." : "Stokları Senkronla"}
      </button>
      {message && !compact ? (
        <p className="max-w-xs text-right text-[11px] font-semibold text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
