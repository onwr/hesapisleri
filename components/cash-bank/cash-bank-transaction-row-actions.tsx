"use client";

import { useState } from "react";
import Link from "next/link";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";
import { LINKED_TRANSACTION_CANCEL_MESSAGE } from "@/lib/transaction-lifecycle-enforcement";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatCashMoney } from "@/lib/cash-bank-page-utils";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type CashBankTransactionRowActionsProps = {
  accountId: string;
  transactionId: string;
  title: string;
  amount: number;
  direction: "in" | "out";
  lifecycleActions: LifecycleActionMatrix;
  isLinked: boolean;
  isTransfer: boolean;
  transferGroupId?: string | null;
  linkedHref?: string;
  recordLabel?: string;
  transferCancelled?: boolean;
  detailHref?: string;
};

export function CashBankTransactionRowActions({
  accountId,
  transactionId,
  title,
  amount,
  direction,
  lifecycleActions,
  isLinked,
  isTransfer,
  transferGroupId,
  linkedHref,
  recordLabel,
  transferCancelled = false,
  detailHref,
}: CashBankTransactionRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [reverseOpen, setReverseOpen] = useState(false);
  const [transferCancelOpen, setTransferCancelOpen] = useState(false);
  const [linkedMessage, setLinkedMessage] = useState("");

  const signedAmount = direction === "in" ? amount : -amount;
  const label = recordLabel ?? title;

  async function handleDelete() {
    const result = await mutate(`/api/cash-bank/transactions/${transactionId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      setLinkedMessage(result.error || "Hareket silinemedi.");
      return;
    }

    notifyTenantCacheSync();
    window.location.reload();
  }

  async function handleReverse(input: { reason: string }) {
    const result = await mutate(`/api/cash-bank/transactions/${transactionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reverse", reason: input.reason }),
    });

    if (!result.ok) {
      return { ok: false, message: result.error || "Ters kayıt oluşturulamadı." };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  async function handleTransferCancel(input: { reason: string }) {
    if (!transferGroupId) {
      return { ok: false, message: "Transfer grubu bulunamadı." };
    }

    const result = await mutate(
      `/api/cash-bank/transfer/${transferGroupId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: input.reason }),
      }
    );

    if (!result.ok) {
      return { ok: false, message: result.error || "Transfer iptal edilemedi." };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  if (isLinked && !isTransfer) {
    return (
      <div className="flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <TransactionRecordActions
          actions={{ view: true, edit: false, delete: false, cancel: false, reverse: false, archive: false, restore: false }}
          viewHref={linkedHref ?? `/cash-bank/transactions/${transactionId}`}
        />
        <p className="max-w-[140px] text-center text-[9px] font-semibold text-amber-700">
          {LINKED_TRANSACTION_CANCEL_MESSAGE}
        </p>
        {linkedHref ? (
          <Link href={linkedHref} className="text-[10px] font-bold text-blue-600 hover:underline">
            Bağlı işleme git
          </Link>
        ) : null}
      </div>
    );
  }

  const actions = isTransfer
    ? {
        view: true,
        edit: false,
        delete: false,
        cancel: !transferCancelled,
        reverse: false,
        archive: false,
        restore: false,
      }
    : lifecycleActions;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <TransactionRecordActions
        actions={actions}
        viewHref={detailHref ?? `/cash-bank/transactions/${transactionId}`}
        onDelete={actions.delete ? () => void handleDelete() : undefined}
        onReverse={actions.reverse ? () => setReverseOpen(true) : undefined}
        onCancel={isTransfer && !transferCancelled ? () => setTransferCancelOpen(true) : undefined}
      />

      {linkedMessage ? (
        <p className="mt-1 max-w-[140px] text-center text-[9px] font-semibold text-rose-600">
          {linkedMessage}
        </p>
      ) : null}

      <TransactionCancelDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        title="Hareketi Ters Kaydet"
        description="Manuel hareket ters kayıt ile iptal edilecek ve hesap bakiyesi güncellenir."
        recordLabel={label}
        recordSummary={formatCashMoney(signedAmount)}
        requiresReason
        confirmLabel="Ters Kayıt Oluştur"
        onConfirm={handleReverse}
        onSuccess={() => window.location.reload()}
      />

      <TransactionCancelDialog
        open={transferCancelOpen}
        onOpenChange={setTransferCancelOpen}
        title="Transferi İptal Et"
        description="Transferin her iki bacağı birlikte iptal edilir. Kaynak ve hedef hesap bakiyeleri geri alınır."
        recordLabel={label}
        recordSummary={formatCashMoney(Math.abs(amount))}
        requiresReason
        impactWarning="Yalnızca transferin tamamı iptal edilebilir; tek bacak silinemez."
        confirmLabel="Transferi İptal Et"
        onConfirm={handleTransferCancel}
        onSuccess={() => window.location.reload()}
      />

      {isSubmitting ? <span className="sr-only">İşleniyor</span> : null}
    </div>
  );
}
