"use client";

import { useState } from "react";
import { TransactionCancelDialog } from "@/components/transactions/transaction-cancel-dialog";
import { TransactionRecordActions } from "@/components/transactions/transaction-record-actions";
import { getWarehouseTransferRowActions } from "@/lib/transaction-lifecycle-row-actions";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

type WarehouseTransferRowActionsProps = {
  transferId: string;
  transferNo: string;
  status: string;
  quantity: number;
  productName: string;
  fromWarehouseName: string;
  toWarehouseName: string;
};

export function WarehouseTransferRowActions({
  transferId,
  transferNo,
  status,
  quantity,
  productName,
  fromWarehouseName,
  toWarehouseName,
}: WarehouseTransferRowActionsProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const actions = getWarehouseTransferRowActions(status);

  if (!actions.cancel && !actions.delete && !actions.edit) {
    return null;
  }

  async function handleCancel(input: { reason: string }) {
    setError("");

    const result = await mutate(`/api/stocks/transfers/${transferId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: input.reason }),
    });

    if (!result.ok && result.error !== "duplicate_submit") {
      return {
        ok: false,
        message: result.error || "Transfer iptal edilemedi.",
      };
    }

    notifyTenantCacheSync();
    return { ok: true };
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <TransactionRecordActions
        actions={actions}
        onCancel={actions.cancel ? () => setOpen(true) : undefined}
      />

      <TransactionCancelDialog
        open={open}
        onOpenChange={setOpen}
        title="Transferi Tersine Çevir"
        description="Tamamlanmış transfer ters stok hareketleri ile iptal edilir. StockMovement doğrudan silinmez."
        recordLabel={transferNo}
        recordSummary={`${productName} · ${quantity} adet · ${fromWarehouseName} → ${toWarehouseName}`}
        requiresReason={status === "COMPLETED"}
        impactWarning="Kaynak ve hedef depo stokları ters yönde güncellenir."
        confirmLabel="Transferi Tersine Çevir"
        onConfirm={handleCancel}
        onSuccess={() => window.location.reload()}
      />

      {error ? (
        <p className="mt-1 text-[10px] font-semibold text-rose-600">{error}</p>
      ) : null}

      {isSubmitting ? <span className="sr-only">İşleniyor</span> : null}
    </div>
  );
}
