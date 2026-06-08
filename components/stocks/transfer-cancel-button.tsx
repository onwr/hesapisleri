"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";

type TransferCancelButtonProps = {
  transferId: string;
  transferNo: string;
};

export function TransferCancelButton({
  transferId,
  transferNo,
}: TransferCancelButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (
      !window.confirm(
        `${transferNo} numaralı transferi iptal etmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/stocks/transfers/${transferId}/cancel`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "İptal edilemedi.");
        return;
      }

      router.refresh();
    } catch {
      setError("Sunucu hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={12} />
        ) : (
          <XCircle size={12} />
        )}
        İptal
      </button>
      {error ? (
        <span className="text-[10px] font-bold text-rose-500">{error}</span>
      ) : null}
    </div>
  );
}
