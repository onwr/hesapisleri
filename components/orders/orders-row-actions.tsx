"use client";

import type { OrderStatus, OrderSourceChannel } from "@prisma/client";
import { OrderRecordActions } from "@/components/orders/order-record-actions";

type OrdersRowActionsProps = {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  sourceChannel: OrderSourceChannel;
  detailHref: string;
  isArchived?: boolean;
};

export function OrdersRowActions({
  orderId,
  orderNo,
  orderStatus,
  sourceChannel,
  detailHref,
  isArchived = false,
}: OrdersRowActionsProps) {
  return (
    <OrderRecordActions
      orderId={orderId}
      orderNo={orderNo}
      orderStatus={orderStatus}
      sourceChannel={sourceChannel}
      detailHref={detailHref}
      isArchived={isArchived}
      compact
    />
  );
}
