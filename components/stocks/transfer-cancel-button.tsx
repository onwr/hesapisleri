"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
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
  const [open, setOpen] = useState(false);

  async function handleCancel(input: { reason: string }) {
    setError("");

    const result = await mutate(
      `/api/stocks/transfers/${transferId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: input.reason }),
      }
    );

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "İptal edilemedi." };
    }

    return { ok: true };
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-100 disabled:opacity-60"
        aria-label={`${transferNo} transferini iptal et`}
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

      <TransactionCancelDialog
        open={open}
        onOpenChange={setOpen}
        title="Stok Transferini İptal Et"
        description="Tamamlanmış transfer terslenir ve stoklar geri alınır."
        recordLabel={transferNo}
        requiresReason
        confirmLabel="Transferi İptal Et"
        onConfirm={handleCancel}
      />
    </div>
  );
}
