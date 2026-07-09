"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { InvoiceCollectModal } from "@/components/invoices/invoice-collect-modal";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatMoney } from "@/lib/invoice-form-utils";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type InvoiceDetailActionsProps = {
  invoiceId: string;
  invoiceNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  editHref: string;
  canCollect: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canEdit: boolean;
  requiresCancelReason: boolean;
  lifecycleActions: LifecycleActionMatrix;
  providerCancelSupported?: boolean;
};

export function InvoiceDetailActions({
  invoiceId,
  invoiceNo,
  total,
  paidAmount,
  remainingAmount,
  editHref,
  canCollect,
  canCancel,
  canDelete,
  canEdit,
  requiresCancelReason,
  lifecycleActions,
  providerCancelSupported = false,
}: InvoiceDetailActionsProps) {
  const router = useRouter();
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [collectOpen, setCollectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const actions: LifecycleActionMatrix = {
    ...lifecycleActions,
    edit: lifecycleActions.edit && canEdit,
    delete: lifecycleActions.delete && canDelete,
    cancel: lifecycleActions.cancel && canCancel,
  };

  async function handleCancelConfirm(input: { reason: string }) {
    setError("");
    setSuccess("");

    const endpoint = providerCancelSupported
      ? `/api/invoices/${invoiceId}/e-document/cancel`
      : `/api/invoices/${invoiceId}`;

    const result = await mutate(endpoint, {
      method: "POST",
      headers: providerCancelSupported
        ? undefined
        : { "Content-Type": "application/json" },
      body: providerCancelSupported
        ? undefined
        : JSON.stringify({ action: "cancel", reason: input.reason }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Fatura iptal edilemedi." };
    }

    notifyTenantCacheSync();
    setSuccess(providerCancelSupported ? "E-Arşiv belgesi iptal edildi." : "Fatura iptal edildi.");
    router.refresh();
    return { ok: true };
  }

  async function handleDelete() {
    setError("");
    setSuccess("");

    const result = await mutate(`/api/invoices/${invoiceId}`, {
      method: "DELETE",
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      setError(result.error || "Fatura silinemedi.");
      return;
    }

    notifyTenantCacheSync();
    router.push("/invoices");
  }

  if (!canCollect && !actions.cancel && !actions.delete && !actions.edit) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {canCollect ? (
          <button
            type="button"
            onClick={() => setCollectOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"
          >
            <Wallet size={15} />
            Tahsilat Al
          </button>
        ) : null}

        <TransactionRecordActions
          actions={actions}
          viewHref={`/invoices/${invoiceId}`}
          editHref={canEdit ? editHref : undefined}
          onCancel={actions.cancel ? () => setCancelOpen(true) : undefined}
          onDelete={actions.delete ? () => void handleDelete() : undefined}
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 print:hidden">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700 print:hidden">
          {success}
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

      <TransactionCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={providerCancelSupported ? "E-Arşiv Belgesini İptal Et" : "Faturayı İptal Et"}
        description={
          providerCancelSupported
            ? "Belge sağlayıcı üzerinden iptal edilecek. Yerel durum yalnızca sağlayıcı onayı sonrası güncellenir."
            : "Bu fatura iptal edilecek. Bağlı satış ve cari kayıtlar kontrollü şekilde güncellenir."
        }
        recordLabel={invoiceNo}
        recordSummary={`${formatMoney(total)} · Ödenen ${formatMoney(paidAmount)}`}
        requiresReason={requiresCancelReason || providerCancelSupported}
        impactWarning={
          paidAmount > 0
            ? "Tahsilatı olan faturalar önce tahsilat iadesi ile kapatılmalıdır."
            : undefined
        }
        confirmLabel={providerCancelSupported ? "E-Arşiv İptal Et" : "Faturayı İptal Et"}
        onConfirm={handleCancelConfirm}
        onSuccess={() => {
          if (!providerCancelSupported) {
            router.push("/invoices");
          }
        }}
      />

      {isSubmitting ? (
        <span className="sr-only">
          <Loader2 className="animate-spin" />
        </span>
      ) : null}
    </>
  );
}
