"use client";

import { useState } from "react";
import { Loader2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

type OrderShippingModalProps = {
  orderId: string;
  orderNo: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function OrderShippingModal({
  orderId,
  orderNo,
  open,
  onClose,
  onSuccess,
}: OrderShippingModalProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippedAt, setShippedAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = await mutate(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderStatus: "SHIPPING",
        shippingCarrier,
        trackingNumber,
        shippedAt: shippedAt ? new Date(shippedAt).toISOString() : undefined,
      }),
    });

    if (!result.ok) {
      setError(result.error ?? "Kargo bilgisi kaydedilemedi.");
      return;
    }

    onSuccess?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-black text-[#0f1f4d]">Kargo Bilgisi Gir</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">
              {orderNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <label className="block">
            <span className="text-[12px] font-bold text-[#24345f]">Kargo Firması</span>
            <input
              value={shippingCarrier}
              onChange={(event) => setShippingCarrier(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:border-blue-300"
              placeholder="Aras Kargo"
              required
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-bold text-[#24345f]">Takip No</span>
            <input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:border-blue-300"
              placeholder="112233445566"
              required
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-bold text-[#24345f]">Kargoya Verildi</span>
            <input
              type="datetime-local"
              value={shippedAt}
              onChange={(event) => setShippedAt(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] outline-none focus:border-blue-300"
            />
          </label>

          {error ? (
            <p className="text-[12px] font-semibold text-rose-500">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full rounded-xl bg-orange-500 font-black hover:bg-orange-600"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Truck size={16} />
                Kargoya Ver
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
