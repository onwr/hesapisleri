"use client";

import { useState } from "react";
import { Archive, Loader2, RotateCcw } from "lucide-react";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type AccountArchiveActionsProps = {
  accountId: string;
  accountName: string;
  balance: number;
  status: string;
  isDefault?: boolean;
  canManage?: boolean;
};

export function AccountArchiveActions({
  accountId,
  accountName,
  balance,
  status,
  isDefault = false,
  canManage = false,
}: AccountArchiveActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({
    refresh: false,
    onSuccess: (_data, message) => {
      setMessage(message ?? (isArchived ? "Hesap yeniden aktifleştirildi." : "Hesap arşivlendi."));
    },
  });
  const [message, setMessage] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (!canManage) return null;

  const isArchived = status === "PASSIVE";

  async function toggleArchive() {
    if (isSubmitting) return;

    if (!isArchived) {
      if (isDefault) {
        setMessage("Varsayılan hesap arşivlenemez. Önce başka bir hesabı varsayılan yapın.");
        return;
      }
      setArchiveOpen(true);
      return;
    }

    setMessage("");

    const result = await mutate(`/api/cash-bank/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      setMessage(result.error || "Hesap durumu güncellenemedi.");
    }
  }

  async function confirmArchive() {
    setMessage("");

    const result = await mutate(`/api/cash-bank/accounts/${accountId}`, {
      method: "DELETE",
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Hesap arşivlenemedi." };
    }

    return { ok: true };
  }

  const archiveWarning =
    balance !== 0
      ? `${accountName} hesabının bakiyesi ${balance.toFixed(2)} TRY. Arşivleme geçmiş hareketleri korur.`
      : `${accountName} hesabı arşivlenecek ve yeni işlem seçimlerinde görünmez.`;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void toggleArchive()}
        disabled={isSubmitting || (!isArchived && isDefault)}
        className="inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#24345f] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={isArchived ? "Hesabı aktifleştir" : "Hesabı arşivle"}
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin" size={15} />
        ) : isArchived ? (
          <RotateCcw size={15} />
        ) : (
          <Archive size={15} />
        )}
        {isArchived ? "Aktifleştir" : "Arşivle"}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-[11px] font-semibold text-slate-600">{message}</p>
      ) : null}

      <TransactionCancelDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Hesabı Arşivle"
        description={archiveWarning}
        recordLabel={accountName}
        requiresReason={false}
        confirmLabel="Arşivle"
        onConfirm={confirmArchive}
      />
    </div>
  );
}
