"use client";

import { useEffect, useState } from "react";
import { InvoiceCollectModal } from "@/components/invoices/invoice-collect-modal";
import { SaleCollectModal } from "@/components/sales/sale-collect-modal";
import type { CollectPaymentTarget } from "@/components/collections/collect-payment-dialog.types";

export type { CollectPaymentTarget } from "@/components/collections/collect-payment-dialog.types";

type CollectPaymentDialogProps = {
  target: CollectPaymentTarget | null;
  onClose: () => void;
};

export function CollectPaymentDialog({
  target,
  onClose,
}: CollectPaymentDialogProps) {
  const [activeTarget, setActiveTarget] = useState<CollectPaymentTarget | null>(
    target
  );

  useEffect(() => {
    setActiveTarget(target);
  }, [target]);

  if (!activeTarget) {
    return null;
  }

  function handleClose() {
    setActiveTarget(null);
    onClose();
  }

  function handleOpenInvoiceCollect(invoiceId: string) {
    if (activeTarget?.type === "INVOICE" && activeTarget.id === invoiceId) {
      return;
    }

    setActiveTarget({
      type: "INVOICE",
      id: invoiceId,
      documentNo: activeTarget?.documentNo ?? "Fatura",
      total: activeTarget?.total ?? 0,
      paidAmount: activeTarget?.paidAmount ?? 0,
      remainingAmount: activeTarget?.remainingAmount ?? 0,
    });
  }

  if (activeTarget.type === "INVOICE") {
    return (
      <InvoiceCollectModal
        open
        onClose={handleClose}
        invoiceId={activeTarget.id}
        invoiceNo={activeTarget.documentNo}
        total={activeTarget.total}
        paidAmount={activeTarget.paidAmount}
        remainingAmount={activeTarget.remainingAmount}
      />
    );
  }

  return (
    <SaleCollectModal
      open
      onClose={handleClose}
      saleId={activeTarget.id}
      saleNo={activeTarget.documentNo}
      total={activeTarget.total}
      paidAmount={activeTarget.paidAmount}
      remainingAmount={activeTarget.remainingAmount}
      invoiceRedirectHint={activeTarget.viaInvoice}
      invoiceId={activeTarget.linkedInvoiceId}
      onOpenInvoiceCollect={(invoiceId) => {
        if (activeTarget.linkedInvoiceId) {
          setActiveTarget({
            type: "INVOICE",
            id: activeTarget.linkedInvoiceId,
            documentNo: activeTarget.documentNo,
            total: activeTarget.total,
            paidAmount: activeTarget.paidAmount,
            remainingAmount: activeTarget.remainingAmount,
          });
          return;
        }

        handleOpenInvoiceCollect(invoiceId);
      }}
    />
  );
}

export function toCollectPaymentTarget(input: {
  collectTargetType?: "SALE" | "INVOICE";
  collectTargetId?: string;
  documentNo: string;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  collectViaInvoice?: boolean;
  linkedInvoiceId?: string | null;
}): CollectPaymentTarget | null {
  if (!input.collectTargetType || !input.collectTargetId) {
    return null;
  }

  return {
    type: input.collectTargetType,
    id: input.collectTargetId,
    documentNo: input.documentNo,
    total: input.totalAmount ?? 0,
    paidAmount: input.paidAmount ?? 0,
    remainingAmount: input.remainingAmount ?? 0,
    viaInvoice: input.collectViaInvoice,
    linkedInvoiceId: input.linkedInvoiceId,
  };
}
