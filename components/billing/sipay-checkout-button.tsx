"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

type Props = {
  planId?: string;
  billingPeriod: "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "YEARLY";
  idempotencyKey: string;
  planName?: string;
  periodLabel?: string;
  amountLabel?: string;
  label?: string;
  disabled?: boolean;
};

type CheckoutResponse = {
  success: boolean;
  data?: { checkoutUrl: string; invoiceId: string };
  message?: string;
};

export function SipayCheckoutButton({
  planId,
  billingPeriod,
  idempotencyKey,
  planName,
  periodLabel,
  amountLabel,
  label = "Sipay ile Güvenli Öde",
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading || disabled) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/sipay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingPeriod, idempotencyKey }),
      });

      const data: CheckoutResponse = await res.json();

      if (!data.success || !data.data?.checkoutUrl) {
        setError(data.message ?? "Ödeme başlatılamadı.");
        return;
      }

      window.location.assign(data.data.checkoutUrl);
    } catch {
      setError("Ağ hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {(planName || periodLabel || amountLabel) && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
          {planName && (
            <p>
              <span className="font-bold text-[#0f1f4d]">{planName}</span>
              {periodLabel ? ` · ${periodLabel}` : ""}
            </p>
          )}
          {amountLabel && (
            <p className="mt-0.5 font-black text-[#0f1f4d]">{amountLabel}</p>
          )}
          <p className="mt-1 flex items-center gap-1 text-slate-500">
            <ShieldCheck size={12} />
            3D Secure ile güvenli ödeme
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] text-[13px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Yönlendiriliyor…
          </>
        ) : (
          label
        )}
      </button>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
