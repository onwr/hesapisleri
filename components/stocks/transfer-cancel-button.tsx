"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type TransferCancelButtonProps = {
  transferId: string;
  transferNo: string;
};

export function TransferCancelButton({
  transferId,
  transferNo,
}: TransferCancelButtonProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");

  async function handleCancel() {
    if (
      !window.confirm(
        `${transferNo} numaralı transferi iptal etmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setError("");

    const result = await mutate(
      `/api/stocks/transfers/${transferId}/cancel`,
      { method: "POST" }
    );

    if (!result.ok && result.error !== "duplicate_submit") {
      setError(result.error || "İptal edilemedi.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 disabled:opacity-60"
      >
        {isSubmitting ? (
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
