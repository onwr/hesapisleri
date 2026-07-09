"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatMoney } from "@/lib/invoice-form-utils";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type InvoiceCollectionRowActionsProps = {
  invoiceId: string;
  invoiceNo: string;
  transactionId: string;
  title: string;
  amount: number;
  accountName: string;
  isReversal?: boolean;
  invoiceStatus: string;
};

export function InvoiceCollectionRowActions({
  invoiceId,
  invoiceNo,
  transactionId,
  title,
  amount,
  accountName,
  isReversal = false,
  invoiceStatus,
}: InvoiceCollectionRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const canReverse =
    !isReversal && invoiceStatus !== "CANCELLED" && amount > 0;

  if (!canReverse) {
    return null;
  }

  async function handleConfirm(input: { reason: string }) {
    setError("");

    const result = await mutate(
      `/api/invoices/collections/${transactionId}/reverse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: input.reason }),
      }
    );

    if (!result.ok && result.error !== "duplicate_submit") {
      return {
        ok: false,
        message: result.error || "Tahsilat ters kaydı oluşturulamadı.",
      };
    }

    notifyTenantCacheSync();

    return { ok: true };
  }

  return (
    <>
      <TransactionRecordActions
        actions={{
          view: false,
          edit: false,
          delete: false,
          cancel: false,
          reverse: true,
          archive: false,
          restore: false,
        }}
        onReverse={() => setOpen(true)}
      />

      <TransactionCancelDialog
        open={open}
        onOpenChange={setOpen}
        title="Tahsilatı Ters Kaydet"
        description="Bu tahsilat ters kayıt ile iptal edilecek. Kasa/banka bakiyesi ve fatura ödeme durumu güncellenir."
        recordLabel={title}
        recordSummary={`${accountName} · ${formatMoney(amount)}`}
        requiresReason
        impactWarning={`${invoiceNo} faturasının ödenen tutarı ve kalan bakiyesi yeniden hesaplanır.`}
        confirmLabel="Tahsilatı Ters Kaydet"
        onConfirm={handleConfirm}
        onSuccess={() => window.location.reload()}
      />

      {error ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">{error}</p>
      ) : null}

      {isSubmitting ? (
        <span className="sr-only">
          <RotateCcw className="animate-spin" />
        </span>
      ) : null}
    </>
  );
}
