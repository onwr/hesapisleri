"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2, Wallet } from "lucide-react";
import { ExpensePayModal } from "@/components/expenses/expense-pay-modal";

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
  canCancel: boolean;
  canPay: boolean;
  accounts: AccountOption[];
};

export function ExpenseDetailActions({
  expenseId,
  expenseTitle,
  amount,
  canCancel,
  canPay,
  accounts,
}: ExpenseDetailActionsProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    if (!canCancel) return;
    if (!window.confirm("Bu gideri iptal etmek istediğinize emin misiniz?")) {
      return;
    }

    setCancelling(true);
    setError("");

    try {
      const response = await fetch(`/api/expenses/${expenseId}/cancel`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Gider iptal edilemedi.");
        return;
      }

      router.push("/expenses");
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setCancelling(false);
    }
  }

  if (!canCancel && !canPay) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canPay ? (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-[12px] font-black text-emerald-700 hover:bg-emerald-100"
          >
            <Wallet size={15} />
            Gideri Öde
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
            Gideri İptal Et
          </button>
        ) : null}
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
    </>
  );
}
