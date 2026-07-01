import { db } from "@/lib/prisma";
import { buildPosCheckoutPayloadHash } from "@/lib/pos-checkout-idempotency";
import type { PosCheckoutInput } from "@/lib/pos-checkout-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";

export type MobileCheckoutStatusResult =
  | { status: "NOT_FOUND" }
  | { status: "PROCESSING" }
  | { status: "CONFLICT" }
  | {
      status: "COMPLETED";
      sale: {
        id: string;
        saleNumber: string;
        createdAt: string;
        total: number;
        paidAmount: number;
        remainingAmount: number;
        currency: "TRY";
        paymentStatus: string;
        itemCount: number;
      };
    };

function serializeSaleSummary(sale: {
  id: string;
  saleNo: string;
  createdAt: Date;
  total: { toString(): string };
  paidAmount: { toString(): string };
  paymentStatus: string;
  items: { length: number };
}) {
  const total = Number(sale.total);
  const paidAmount = Number(sale.paidAmount);
  return {
    id: sale.id,
    saleNumber: sale.saleNo,
    createdAt: sale.createdAt.toISOString(),
    total,
    paidAmount,
    remainingAmount: getInvoiceRemainingAmount(total, paidAmount),
    currency: "TRY" as const,
    paymentStatus: sale.paymentStatus,
    itemCount: sale.items.length,
  };
}

export async function resolveMobilePosCheckoutStatus(input: {
  companyId: string;
  idempotencyKey: string;
  payloadHash?: string | null;
}): Promise<MobileCheckoutStatusResult> {
  const sale = await db.sale.findFirst({
    where: {
      companyId: input.companyId,
      idempotencyKey: input.idempotencyKey,
      sourceChannel: "POS",
    },
    select: {
      id: true,
      saleNo: true,
      createdAt: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      status: true,
      payloadHash: true,
      items: { select: { id: true } },
    },
  });

  if (!sale) {
    return { status: "NOT_FOUND" };
  }

  if (input.payloadHash && sale.payloadHash && sale.payloadHash !== input.payloadHash) {
    return { status: "CONFLICT" };
  }

  if (sale.status !== "COMPLETED") {
    return { status: "PROCESSING" };
  }

  return {
    status: "COMPLETED",
    sale: serializeSaleSummary(sale),
  };
}

export function buildCheckoutPayloadHashFromInput(data: PosCheckoutInput) {
  return buildPosCheckoutPayloadHash(data);
}
