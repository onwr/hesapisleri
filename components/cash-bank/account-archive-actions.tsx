"use client";

import { useState } from "react";
import { Archive, Loader2, RotateCcw } from "lucide-react";
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

  if (!canManage) return null;

  const isArchived = status === "PASSIVE";

  async function toggleArchive() {
    if (isSubmitting) return;

    if (!isArchived) {
      const warning =
        balance !== 0
          ? `${accountName} hesabının bakiyesi ${balance.toFixed(2)} TRY. Arşivleme geçmiş hareketleri korur; yeni işlem seçimlerinde görünmez.`
          : `${accountName} hesabı arşivlenecek. Yeni işlem seçimlerinde görünmez.`;

      const confirmed = window.confirm(
        isDefault
          ? "Varsayılan hesap arşivlenemez."
          : `${warning}\n\nDevam etmek istiyor musunuz?`
      );

      if (!confirmed || isDefault) return;
    }

    setMessage("");

    const result = await mutate(`/api/cash-bank/accounts/${accountId}`, {
      method: isArchived ? "PATCH" : "DELETE",
      headers: isArchived ? { "Content-Type": "application/json" } : undefined,
      body: isArchived ? JSON.stringify({ status: "ACTIVE" }) : undefined,
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      setMessage(result.error || "Hesap durumu güncellenemedi.");
    }
  }

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
    </div>
  );
}
