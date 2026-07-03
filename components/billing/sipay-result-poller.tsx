"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  invoiceId: string;
  initialStatus: string;
};

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 15;

type FinalizeResponse = {
  success: boolean;
  data?: {
    status: string;
    completed: boolean;
    verificationPending: boolean;
  };
  message?: string;
};

export function SipayResultPoller({ invoiceId, initialStatus }: Props) {
  const router = useRouter();
  const [polling, setPolling] = useState(
    initialStatus === "PENDING" ||
      initialStatus === "CHECKOUT_LINK_READY" ||
      initialStatus === "CREATED" ||
      initialStatus === "FAILED",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!polling) return;

    let cancelled = false;
    let pollCount = 0;

    async function poll() {
      while (!cancelled && pollCount < MAX_POLLS) {
        pollCount += 1;

        try {
          const res = await fetch("/api/billing/sipay/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoiceId }),
          });
          const json: FinalizeResponse = await res.json();

          if (!res.ok || !json.success) {
            setMessage(json.message ?? "Ödeme durumu doğrulanamadı.");
            break;
          }

          if (json.data?.completed) {
            router.refresh();
            setPolling(false);
            return;
          }

          if (!json.data?.verificationPending && json.data?.status === "FAILED") {
            setPolling(false);
            return;
          }
        } catch {
          setMessage("Ağ hatası. Sayfayı yenileyerek tekrar deneyin.");
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        setPolling(false);
        if (pollCount >= MAX_POLLS) {
          setMessage("Ödeme hâlâ doğrulanıyor. Birkaç dakika sonra billing sayfasından kontrol edin.");
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
  }, [invoiceId, polling, router]);

  if (!polling && !message) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {polling ? (
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 className="animate-spin" size={16} />
          Ödeme Sipay üzerinden doğrulanıyor…
        </p>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}
