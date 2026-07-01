"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { InvoiceCollectModal } from "@/components/invoices/invoice-collect-modal";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type InvoiceDetailActionsProps = {
  invoiceId: string;
  invoiceNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  canCollect: boolean;
  canCancel: boolean;
};

export function InvoiceDetailActions({
  invoiceId,
  invoiceNo,
  total,
  paidAmount,
  remainingAmount,
  canCollect,
  canCancel,
}: InvoiceDetailActionsProps) {
  const router = useRouter();
  const { mutate, isSubmitting: cancelling } = useTenantMutation({ refresh: false });
  const [collectOpen, setCollectOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (!canCancel) return;
    if (!window.confirm("Bu faturayı iptal etmek istediğinize emin misiniz?")) {
      return;
    }

    setError("");

    const result = await mutate(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });

    if (!result.ok) {
      setError(result.error ?? "Fatura iptal edilemedi.");
      return;
    }

    router.push("/invoices");
  }

  if (!canCollect && !canCancel) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        {canCollect ? (
          <button
            type="button"
            onClick={() => setCollectOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-[12px] font-black text-emerald-700 hover:bg-emerald-100"
          >
            <Wallet size={15} />
            Tahsilat Al
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-[12px] font-black text-rose-700 disabled:opacity-60"
          >
            {cancelling ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Trash2 size={15} />
            )}
            Faturayı İptal Et
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 print:hidden">
          {error}
        </div>
      ) : null}

      {canCollect ? (
        <InvoiceCollectModal
          open={collectOpen}
          onClose={() => setCollectOpen(false)}
          invoiceId={invoiceId}
          invoiceNo={invoiceNo}
          total={total}
          paidAmount={paidAmount}
          remainingAmount={remainingAmount}
        />
      ) : null}
    </>
  );
}
