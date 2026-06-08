"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Edit3, Eye, MoreVertical, Truck } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { OrderShippingModal } from "@/components/orders/order-shipping-modal";

type OrdersRowActionsProps = {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  detailHref: string;
};

export function OrdersRowActions({
  orderId,
  orderNo,
  orderStatus,
  detailHref,
}: OrdersRowActionsProps) {
  const router = useRouter();
  const [shippingOpen, setShippingOpen] = useState(false);
  const canAddShipping =
    orderStatus === "APPROVED" || orderStatus === "SHIPPING";

  return (
    <>
      <div className="mx-auto grid w-[62px] grid-cols-2 gap-1">
        <Link
          href={detailHref}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          title="Detay"
        >
          <Eye size={13} />
        </Link>

        <Link
          href={detailHref}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          title="Düzenle"
        >
          <Edit3 size={13} />
        </Link>

        {canAddShipping ? (
          <button
            type="button"
            onClick={() => setShippingOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-orange-100 hover:bg-orange-50 hover:text-orange-600"
            title="Kargo Bilgisi Gir"
          >
            <Truck size={13} />
          </button>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-300">
            <Truck size={13} />
          </span>
        )}

        <Link
          href={detailHref}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
          title="Diğer"
        >
          <MoreVertical size={13} />
        </Link>
      </div>

      <OrderShippingModal
        orderId={orderId}
        orderNo={orderNo}
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
