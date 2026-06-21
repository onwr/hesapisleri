"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, X } from "lucide-react";

type AdminMembershipPaymentActionsProps = {
  paymentId: string;
  status: string;
  amountMinor?: number | null;
};

export function AdminMembershipPaymentActions({
  paymentId,
  status,
  amountMinor,
}: AdminMembershipPaymentActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: "PAID" | "FAILED" | "CANCELLED") {
    if (
      nextStatus === "PAID" &&
      !window.confirm("Bu ödemeyi onaylayıp üyeliği uzatmak istiyor musunuz?")
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/membership-payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "İşlem başarısız.");
        return;
      }

      router.refresh();
    } catch {
      setError("İşlem sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function refundPayment() {
    if (!amountMinor) return;
    const reason = window.prompt("İade nedeni", "Müşteri talebi");
    if (!reason) return;
    const rawAmount = window.prompt(
      "İade tutarı (kuruş)",
      String(amountMinor)
    );
    const parsedAmount = Number(rawAmount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor: parsedAmount,
          reason,
          accessAction: "MANUAL_REVIEW",
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "İade başlatılamadı.");
        return;
      }

      router.refresh();
    } catch {
      setError("İade sırasında bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (status !== "PENDING") {
    if (status === "PAID") {
      return (
        <div className="space-y-2">
          <button
            type="button"
            disabled={saving || !amountMinor}
            onClick={() => void refundPayment()}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
            İade
          </button>
          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>
      );
    }

    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void updateStatus("PAID")}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          Onayla
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void updateStatus("FAILED")}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600 disabled:opacity-50"
        >
          <X size={14} />
          Reddet
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void updateStatus("CANCELLED")}
          className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 disabled:opacity-50"
        >
          İptal
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
