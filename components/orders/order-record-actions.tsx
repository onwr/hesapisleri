"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import type { OrderStatus, OrderSourceChannel } from "@prisma/client";
import { OrderShippingModal } from "@/components/orders/order-shipping-modal";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import { resolveOrderLifecycleActions } from "@/lib/order-lifecycle-utils";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type OrderRecordActionsProps = {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  sourceChannel: OrderSourceChannel;
  detailHref: string;
  isArchived?: boolean;
  compact?: boolean;
};

export function OrderRecordActions({
  orderId,
  orderNo,
  orderStatus,
  sourceChannel,
  detailHref,
  isArchived = false,
  compact = false,
}: OrderRecordActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [shippingOpen, setShippingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState("");

  const lifecycle = resolveOrderLifecycleActions({
    sourceChannel,
    status: orderStatus,
    isArchived,
  });

  const canAddShipping =
    !lifecycle.isMarketplace &&
    (orderStatus === "APPROVED" || orderStatus === "SHIPPING");

  async function handleArchive() {
    setError("");
    const result = await mutate(`/api/orders/${orderId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Sipariş arşivlenemedi." };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  async function handleRestore() {
    setError("");
    const result = await mutate(`/api/orders/${orderId}/restore`, {
      method: "POST",
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Sipariş arşivden çıkarılamadı." };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  async function handleCancel() {
    setError("");
    const result = await mutate(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderStatus: "CANCELLED" }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return { ok: false, message: result.error || "Sipariş iptal edilemedi." };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  if (compact) {
    return (
      <div onClick={(event) => event.stopPropagation()}>
        <TransactionRecordActions
          actions={lifecycle.lifecycleActions}
          viewHref={detailHref}
          editHref={lifecycle.lifecycleActions.edit ? detailHref : undefined}
          onCancel={lifecycle.lifecycleActions.cancel ? () => setCancelOpen(true) : undefined}
          onArchive={lifecycle.lifecycleActions.archive ? () => setArchiveOpen(true) : undefined}
          onRestore={lifecycle.lifecycleActions.restore ? () => setRestoreOpen(true) : undefined}
          ariaLabel={`${orderNo} sipariş işlemleri`}
        />

        {error ? (
          <p className="mt-1 max-w-[140px] text-center text-[9px] font-semibold text-rose-600">
            {error}
          </p>
        ) : null}

        <TransactionCancelDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          title="Siparişi Arşivle"
          description="Sipariş yerel listeden arşivlenir. Pazaryeri senkronu durumu güncellemeye devam edebilir."
          recordLabel={orderNo}
          requiresReason={false}
          confirmLabel="Arşivle"
          onConfirm={handleArchive}
        />

        <TransactionCancelDialog
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
          title="Arşivden Çıkar"
          description="Sipariş tekrar aktif listeye alınır."
          recordLabel={orderNo}
          requiresReason={false}
          confirmLabel="Arşivden Çıkar"
          onConfirm={handleRestore}
        />

        <TransactionCancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Siparişi İptal Et"
          description="Operasyonel sipariş iptali. Finansal satış iptali değildir."
          recordLabel={orderNo}
          requiresReason={false}
          confirmLabel="İptal Et"
          onConfirm={handleCancel}
        />

        {isSubmitting ? <span className="sr-only">İşleniyor</span> : null}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TransactionRecordActions
          actions={lifecycle.lifecycleActions}
          viewHref={detailHref}
          editHref={lifecycle.lifecycleActions.edit ? detailHref : undefined}
          onCancel={lifecycle.lifecycleActions.cancel ? () => setCancelOpen(true) : undefined}
          onArchive={lifecycle.lifecycleActions.archive ? () => setArchiveOpen(true) : undefined}
          onRestore={lifecycle.lifecycleActions.restore ? () => setRestoreOpen(true) : undefined}
          ariaLabel={`${orderNo} sipariş işlemleri`}
        />

        {canAddShipping ? (
          <button
            type="button"
            onClick={() => setShippingOpen(true)}
            disabled={isSubmitting}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[11px] font-black text-orange-700 hover:bg-orange-100 disabled:opacity-60"
            aria-label={`${orderNo} kargo bilgisi`}
          >
            <Truck size={14} />
            Kargo
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-semibold text-rose-500">{error}</p>
      ) : null}

      <TransactionCancelDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Siparişi Arşivle"
        description="Sipariş yerel listeden arşivlenir. Pazaryeri senkronu durumu güncellemeye devam edebilir."
        recordLabel={orderNo}
        requiresReason={false}
        confirmLabel="Arşivle"
        onConfirm={handleArchive}
      />

      <TransactionCancelDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Arşivden Çıkar"
        description="Sipariş tekrar aktif listeye alınır."
        recordLabel={orderNo}
        requiresReason={false}
        confirmLabel="Arşivden Çıkar"
        onConfirm={handleRestore}
      />

      <TransactionCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Siparişi İptal Et"
        description="Operasyonel sipariş iptali. Finansal satış iptali değildir."
        recordLabel={orderNo}
        requiresReason={false}
        confirmLabel="İptal Et"
        onConfirm={handleCancel}
      />

      <OrderShippingModal
        orderId={orderId}
        orderNo={orderNo}
        open={shippingOpen}
        onClose={() => setShippingOpen(false)}
        onSuccess={() => notifyTenantCacheSync()}
      />
    </>
  );
}
