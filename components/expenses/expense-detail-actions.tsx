"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { ExpensePayModal } from "@/components/expenses/expense-pay-modal";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatExpenseMoney } from "@/lib/expenses-page-utils";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type ExpenseDetailActionsProps = {
  expenseId: string;
  expenseTitle: string;
  amount: number;
  lifecycleActions: LifecycleActionMatrix;
  requiresCancelReason?: boolean;
  accounts: AccountOption[];
};

export function ExpenseDetailActions({
  expenseId,
  expenseTitle,
  amount,
  lifecycleActions,
  requiresCancelReason = false,
  accounts,
}: ExpenseDetailActionsProps) {
  const router = useRouter();
  const { mutate, isSubmitting } = useTenantMutation({
    refresh: false,
    onSuccess: () => router.push("/expenses"),
  });
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState("");

  const canPay = lifecycleActions.edit && accounts.length > 0;

  async function handleCancelConfirm(input: { reason: string }) {
    setError("");

    const result = await mutate(`/api/expenses/${expenseId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: input.reason }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Gider iptal edilemedi." };
    }

    return { ok: true };
  }

  async function handleDelete() {
    setError("");

    const result = await mutate(`/api/expenses/${expenseId}`, {
      method: "DELETE",
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      setError(result.error || "Gider silinemedi.");
      return;
    }

    router.push("/expenses");
  }

  if (
    !lifecycleActions.cancel &&
    !lifecycleActions.delete &&
    !canPay &&
    !lifecycleActions.edit
  ) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canPay ? (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"
          >
            <Wallet size={15} />
            Gideri Öde
          </button>
        ) : null}

        <TransactionRecordActions
          actions={lifecycleActions}
          viewHref={`/expenses/${expenseId}`}
          editHref={lifecycleActions.edit ? `/expenses/${expenseId}/edit` : undefined}
          onCancel={
            lifecycleActions.cancel ? () => setCancelOpen(true) : undefined
          }
          onDelete={lifecycleActions.delete ? () => void handleDelete() : undefined}
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
          {error}
        </div>
      ) : null}

      {canPay ? (
        <ExpensePayModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          expenseId={expenseId}
          expenseTitle={expenseTitle}
          amount={amount}
          accounts={accounts}
        />
      ) : null}

      <TransactionCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Gideri İptal Et"
        description="Bu gider iptal edilecek. Ödenmiş giderlerde kasa/banka bakiyesi geri alınır."
        recordLabel={expenseTitle}
        recordSummary={formatExpenseMoney(amount)}
        requiresReason={requiresCancelReason}
        impactWarning={
          requiresCancelReason
            ? "Ödenmiş gider iptalinde bağlı kasa/banka hareketi ters kayıt ile iptal edilir."
            : undefined
        }
        confirmLabel="Gideri İptal Et"
        onConfirm={handleCancelConfirm}
        onSuccess={() => router.push("/expenses")}
      />

      {isSubmitting ? (
        <span className="sr-only">
          <Loader2 className="animate-spin" />
        </span>
      ) : null}
    </>
  );
}
