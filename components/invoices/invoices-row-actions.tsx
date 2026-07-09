"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CollectPaymentDialog,
  toCollectPaymentTarget,
  type CollectPaymentTarget,
} from "@/components/collections/collect-payment-dialog";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import type { InvoiceRowActionData } from "@/lib/invoices-page-utils";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatInvoiceMoney } from "@/lib/invoices-page-utils";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type InvoicesRowActionsProps = {
  row: InvoiceRowActionData;
};

const E_INVOICE_PROVIDER_CANCEL_MESSAGE =
  "Bu e-fatura sağlayıcı üzerinden iptal edilmelidir.";

export function InvoicesRowActions({ row }: InvoicesRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [collectTarget, setCollectTarget] = useState<CollectPaymentTarget | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isCancelled = row.invoiceStatus === "CANCELLED";
  const showCollectionsLink =
    !isCancelled &&
    row.invoiceStatus !== "DRAFT" &&
    ((row.paidAmount ?? 0) > 0 ||
      row.paymentStatus === "PARTIAL" ||
      row.paymentStatus === "PAID");

  const menuActions = isCancelled
    ? { view: true, edit: false, delete: false, cancel: false, reverse: false, archive: false, restore: false }
    : {
        ...row.lifecycleActions,
        edit: row.canEdit,
        delete: row.canDelete,
        cancel: row.canCancel || row.providerCancelSupported,
      };

  function openCollectModal() {
    setCollectTarget(
      toCollectPaymentTarget({
        collectTargetType: "INVOICE",
        collectTargetId: row.id,
        documentNo: row.invoiceNo,
        totalAmount: row.totalAmount ?? 0,
        paidAmount: row.paidAmount ?? 0,
        remainingAmount: row.remainingAmount ?? 0,
      })
    );
  }

  async function handleCancelConfirm(input: { reason: string }) {
    setError("");
    setSuccess("");

    if (row.requiresProviderCancel) {
      return { ok: false, message: E_INVOICE_PROVIDER_CANCEL_MESSAGE };
    }

    const endpoint = row.providerCancelSupported
      ? `/api/invoices/${row.id}/e-document/cancel`
      : `/api/invoices/${row.id}`;

    const result = await mutate(endpoint, {
      method: row.providerCancelSupported ? "POST" : "PATCH",
      headers: row.providerCancelSupported
        ? undefined
        : { "Content-Type": "application/json" },
      body: row.providerCancelSupported
        ? undefined
        : JSON.stringify({ action: "cancel", reason: input.reason }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Fatura iptal edilemedi." };
    }

    notifyTenantCacheSync();
    setSuccess(row.providerCancelSupported ? "E-Arşiv belgesi iptal edildi." : "Fatura iptal edildi.");
    return { ok: true };
  }

  async function handleDeleteConfirm() {
    setError("");
    setSuccess("");

    const result = await mutate(`/api/invoices/${row.id}`, {
      method: "DELETE",
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Fatura silinemedi." };
    }

    notifyTenantCacheSync();
    setSuccess("Fatura silindi.");
    return { ok: true };
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-col items-center gap-1">
        <TransactionRecordActions
          actions={menuActions}
          viewHref={row.detailHref}
          editHref={row.canEdit ? row.editHref : undefined}
          onCancel={
            row.canCancel || row.providerCancelSupported
              ? () => setCancelOpen(true)
              : undefined
          }
          onDelete={row.canDelete ? () => setDeleteOpen(true) : undefined}
          ariaLabel={`${row.invoiceNo} fatura işlemleri`}
        />

        {showCollectionsLink ? (
          <Link
            href={row.collectionsHref}
            className="text-[10px] font-bold text-blue-600 hover:underline"
            aria-label={`${row.invoiceNo} tahsilatları görüntüle`}
          >
            Tahsilatlar
          </Link>
        ) : null}

        {row.requiresProviderCancel ? (
          <p className="max-w-[160px] text-center text-[9px] font-semibold text-amber-700">
            {E_INVOICE_PROVIDER_CANCEL_MESSAGE}
          </p>
        ) : null}

        {row.canCollect ? (
          <button
            type="button"
            onClick={openCollectModal}
            disabled={isSubmitting}
            className="text-[10px] font-bold text-emerald-700 hover:underline disabled:opacity-60"
            aria-label={`${row.invoiceNo} tahsilat al`}
          >
            Tahsilat Al
          </button>
        ) : null}

        {error ? (
          <p className="max-w-[180px] text-center text-[10px] font-semibold text-rose-500">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="max-w-[180px] text-center text-[10px] font-semibold text-emerald-600">
            {success}
          </p>
        ) : null}
      </div>

      <CollectPaymentDialog
        target={collectTarget}
        onClose={() => setCollectTarget(null)}
      />

      <TransactionCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={row.providerCancelSupported ? "E-Arşiv Belgesini İptal Et" : "Faturayı İptal Et"}
        description={
          row.providerCancelSupported
            ? "Belge sağlayıcı üzerinden iptal edilecek. Yerel durum yalnızca sağlayıcı onayı sonrası güncellenir."
            : "Bu fatura iptal edilecek. Bağlı satış ve cari kayıtlar kontrollü şekilde güncellenir."
        }
        recordLabel={row.invoiceNo}
        recordSummary={`${formatInvoiceMoney(row.totalAmount ?? 0)} · Ödenen ${formatInvoiceMoney(row.paidAmount ?? 0)}`}
        requiresReason={row.requiresCancelReason || row.providerCancelSupported}
        impactWarning={
          (row.paidAmount ?? 0) > 0
            ? "Tahsilatı olan faturalar önce tahsilat iadesi ile kapatılmalıdır."
            : undefined
        }
        confirmLabel={row.providerCancelSupported ? "E-Arşiv İptal Et" : "Faturayı İptal Et"}
        onConfirm={handleCancelConfirm}
        onSuccess={() => notifyTenantCacheSync()}
      />

      <TransactionCancelDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Faturayı Sil"
        description="Taslak fatura kalıcı olarak silinecek."
        recordLabel={row.invoiceNo}
        requiresReason={false}
        confirmLabel="Sil"
        onConfirm={handleDeleteConfirm}
        onSuccess={() => notifyTenantCacheSync()}
      />

      {isSubmitting ? <span className="sr-only">İşleniyor</span> : null}
    </div>
  );
}
