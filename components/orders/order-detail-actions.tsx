"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Ban,
  CheckCircle2,
  Loader2,
  PackageCheck,
  RotateCcw,
  Truck,
} from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { getAllowedNextStatuses } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { OrderShippingModal } from "@/components/orders/order-shipping-modal";

type OrderDetailActionsProps = {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
};

const ACTION_CONFIG: Partial<
  Record<
    OrderStatus,
    {
      label: string;
      nextStatus: OrderStatus;
      icon: typeof CheckCircle2;
      tone: string;
    }
  >
> = {
  WAITING: {
    label: "Onayla ve Stok Düş",
    nextStatus: "APPROVED",
    icon: CheckCircle2,
    tone: "bg-emerald-600 hover:bg-emerald-700",
  },
  APPROVED: {
    label: "Kargoya Ver",
    nextStatus: "SHIPPING",
    icon: Truck,
    tone: "bg-orange-500 hover:bg-orange-600",
  },
  SHIPPING: {
    label: "Teslim Edildi Yap",
    nextStatus: "DELIVERED",
    icon: PackageCheck,
    tone: "bg-blue-600 hover:bg-blue-700",
  },
  DELIVERED: {
    label: "İade Talebi Oluştur",
    nextStatus: "RETURN_REQUESTED",
    icon: RotateCcw,
    tone: "bg-rose-500 hover:bg-rose-600",
  },
  RETURN_REQUESTED: {
    label: "İade Tamamla",
    nextStatus: "RETURNED",
    icon: RotateCcw,
    tone: "bg-rose-600 hover:bg-rose-700",
  },
};

export function OrderDetailActions({
  orderId,
  orderNo,
  orderStatus,
}: OrderDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shippingOpen, setShippingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const primaryAction = ACTION_CONFIG[orderStatus];
  const canCancel =
    orderStatus === "WAITING" || orderStatus === "APPROVED";
  const allowedNext = getAllowedNextStatuses(orderStatus);

  function updateStatus(nextStatus: OrderStatus, extra?: Record<string, unknown>) {
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: nextStatus,
          orderNote: note.trim() || undefined,
          ...extra,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message ?? "İşlem başarısız.");
        return;
      }

      router.refresh();
    });
  }

  function approveAndDecrementStock() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}/approve`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? "Sipariş onaylanamadı.");
        return;
      }
      router.refresh();
    });
  }

  function handlePrimaryAction() {
    if (!primaryAction) return;

    if (orderStatus === "WAITING") {
      approveAndDecrementStock();
      return;
    }

    if (primaryAction.nextStatus === "SHIPPING") {
      setShippingOpen(true);
      return;
    }

    updateStatus(primaryAction.nextStatus);
  }

  function handleCancel() {
    if (!canCancel) return;
    updateStatus("CANCELLED");
  }

  if (allowedNext.length === 0 && !canCancel) {
    return (
      <p className="text-[12px] font-semibold text-slate-500">
        Bu sipariş için kullanılabilir operasyon aksiyonu yok.
      </p>
    );
  }

  const PrimaryIcon = primaryAction?.icon ?? CheckCircle2;

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-[12px] font-bold text-[#24345f]">Operasyon Notu</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-300"
          placeholder="İade veya iptal notu..."
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {primaryAction ? (
          <Button
            type="button"
            disabled={isPending}
            onClick={handlePrimaryAction}
            className={["h-10 rounded-xl font-black text-white", primaryAction.tone].join(
              " "
            )}
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <PrimaryIcon size={16} />
            )}
            {primaryAction.label}
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleCancel}
            className="h-10 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"
          >
            <Ban size={16} />
            İptal Et
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] leading-5 text-slate-500">
        Sipariş iadesi operasyonel durumdur. Finansal iade için satış iptal/iade
        işlemi kullanılır. Sipariş iptali finansal satış iptali değildir.
      </p>

      {error ? (
        <p className="text-[12px] font-semibold text-rose-500">{error}</p>
      ) : null}

      <OrderShippingModal
        orderId={orderId}
        orderNo={orderNo}
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
