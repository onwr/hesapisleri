"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import { Loader2 } from "lucide-react";

type PaymentStatusActionsProps = {
  paymentId: string;
  initialStatus: string;
  autoSync?: boolean;
};

export function PaymentStatusActions({
  paymentId,
  initialStatus,
  autoSync = false,
}: PaymentStatusActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const autoSyncStarted = useRef(false);

  const syncPayment = useCallback(async () => {
    setSyncing(true);
    setMessage("");

    try {
      const res = await fetch(`/api/billing/payments/${paymentId}/sync`, {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setMessage(json.message || "Ödeme durumu doğrulanamadı.");
        return;
      }

      setStatus(json.data.status);
      setMessage(json.data.message || "");

      if (json.data.status === "PAID") {
        notifyTenantCacheSync();
      }
    } catch {
      setMessage("Ödeme durumu doğrulanamadı.");
    } finally {
      setSyncing(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!autoSync || autoSyncStarted.current) return;
    if (initialStatus === "PAID") return;
    autoSyncStarted.current = true;
    void syncPayment();
  }, [autoSync, initialStatus, syncPayment]);

  const waiting =
    status === "CREATED" ||
    status === "FORM_READY" ||
    status === "PENDING" ||
    status === "WAIT_CALLBACK" ||
    status === "UNKNOWN";

  return (
    <div className="mt-5 space-y-3">
      {message ? (
        <p
          className={[
            "rounded-xl px-3 py-2 text-[12px] font-semibold",
            status === "PAID"
              ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border border-slate-200 bg-slate-50 text-slate-700",
          ].join(" ")}
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {waiting ? (
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncPayment()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0f1f4d] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {syncing ? <Loader2 className="animate-spin" size={16} /> : null}
            Durumu Kontrol Et
          </button>
        ) : null}
        <Link
          href="/settings/billing"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-[#0f1f4d]"
        >
          Billing Sayfasına Dön
        </Link>
      </div>
    </div>
  );
}
