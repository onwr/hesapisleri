import type { Prisma } from "@prisma/client";
import { summarizeMembershipPaymentError } from "@/lib/admin/admin-overview-payment-labels";
import { decimalToNumber } from "@/lib/admin/admin-overview-prisma-utils";

export function shortId(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function maskProviderId(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function maskIp(ip: string | null | undefined) {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.•••.•••`;
  return ip.length > 6 ? `${ip.slice(0, 4)}•••` : "•••";
}

export function serializeLastPayment(
  payment:
    | {
        id: string;
        amount: Prisma.Decimal | number;
        currency: string;
        status: string;
        paidAt: Date | null;
        failedAt: Date | null;
        createdAt: Date;
        failedReasonCode?: string | null;
        failedReasonMessage?: string | null;
        providerStatus?: string | null;
      }
    | null
    | undefined
) {
  if (!payment) {
    return {
      id: null,
      status: null,
      amount: null,
      currency: null,
      date: null,
      errorSummary: null,
    };
  }

  return {
    id: payment.id,
    status: payment.status,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    date: (
      payment.paidAt ??
      payment.failedAt ??
      payment.createdAt
    ).toISOString(),
    errorSummary:
      payment.status === "FAILED"
        ? summarizeMembershipPaymentError(payment)
        : null,
  };
}
