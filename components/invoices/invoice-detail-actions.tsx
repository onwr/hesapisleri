"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { InvoiceCollectModal } from "@/components/invoices/invoice-collect-modal";

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
  const [collectOpen, setCollectOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (!canCancel) return;
    if (!window.confirm("Bu faturayı iptal etmek istediğinize emin misiniz?")) {
      return;
    }

    setCancelling(true);
    setError("");

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Fatura iptal edilemedi.");
        return;
      }

      router.push("/invoices");
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setCancelling(false);
    }
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
