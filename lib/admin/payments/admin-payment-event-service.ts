import {
  maskEventKey,
  maskIp,
} from "@/lib/admin/payments/admin-payment-serializers";

export type PaymentTimelineEvent = {
  id: string;
  source: "webhook" | "payment" | "outbox" | "refund" | "activity";
  priority: number;
  title: string;
  detail?: string;
  status?: string;
  occurredAt: string;
};

const SOURCE_PRIORITY: Record<PaymentTimelineEvent["source"], number> = {
  webhook: 1,
  payment: 2,
  outbox: 3,
  refund: 4,
  activity: 5,
};

type RawEventInput = {
  payment: {
    id: string;
    status: string;
    createdAt: Date;
    paidAt: Date | null;
    failedAt: Date | null;
    callbackReceivedAt: Date | null;
  };
  webhooks: Array<{
    id: string;
    eventKey: string;
    signatureValid: boolean;
    processingStatus: string;
    receivedAt: Date;
    processedAt: Date | null;
    lastError: string | null;
    attemptCount: number;
  }>;
  outbox: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    processedAt: Date | null;
    lastError: string | null;
  }>;
  refunds: Array<{
    id: string;
    status: string;
    amountMinor: number;
    currency: string;
    completedAt: Date | null;
    createdAt: Date;
  }>;
  activity: Array<{
    id: string;
    action: string;
    message: string | null;
    createdAt: Date;
  }>;
};

export function buildPaymentTimelineEvents(input: RawEventInput): PaymentTimelineEvent[] {
  const events: PaymentTimelineEvent[] = [];

  events.push({
    id: `payment-created:${input.payment.id}`,
    source: "payment",
    priority: SOURCE_PRIORITY.payment,
    title: "Ödeme kaydı oluşturuldu",
    status: input.payment.status,
    occurredAt: input.payment.createdAt.toISOString(),
  });

  if (input.payment.paidAt) {
    events.push({
      id: `payment-paid:${input.payment.id}`,
      source: "payment",
      priority: SOURCE_PRIORITY.payment,
      title: "Ödeme PAID durumuna geçti",
      status: "PAID",
      occurredAt: input.payment.paidAt.toISOString(),
    });
  }

  if (input.payment.failedAt) {
    events.push({
      id: `payment-failed:${input.payment.id}`,
      source: "payment",
      priority: SOURCE_PRIORITY.payment,
      title: "Ödeme başarısız",
      status: "FAILED",
      occurredAt: input.payment.failedAt.toISOString(),
    });
  }

  for (const wh of input.webhooks) {
    events.push({
      id: `webhook:${wh.id}`,
      source: "webhook",
      priority: SOURCE_PRIORITY.webhook,
      title: `Webhook ${wh.processingStatus}`,
      detail: `eventKey=${maskEventKey(wh.eventKey)} attempt=${wh.attemptCount}${
        wh.lastError ? ` · ${wh.lastError}` : ""
      }`,
      status: wh.processingStatus,
      occurredAt: (wh.processedAt ?? wh.receivedAt).toISOString(),
    });
  }

  for (const ob of input.outbox) {
    events.push({
      id: `outbox:${ob.id}`,
      source: "outbox",
      priority: SOURCE_PRIORITY.outbox,
      title: `Billing outbox: ${ob.type}`,
      detail: ob.lastError ?? undefined,
      status: ob.status,
      occurredAt: (ob.processedAt ?? ob.createdAt).toISOString(),
    });
  }

  for (const rf of input.refunds) {
    events.push({
      id: `refund:${rf.id}:${rf.status}`,
      source: "refund",
      priority: SOURCE_PRIORITY.refund,
      title: `İade ${rf.status}`,
      detail: `${rf.amountMinor} ${rf.currency}`,
      status: rf.status,
      occurredAt: (rf.completedAt ?? rf.createdAt).toISOString(),
    });
  }

  for (const log of input.activity) {
    events.push({
      id: `activity:${log.id}`,
      source: "activity",
      priority: SOURCE_PRIORITY.activity,
      title: log.action,
      detail: log.message ?? undefined,
      occurredAt: log.createdAt.toISOString(),
    });
  }

  const byId = new Map<string, PaymentTimelineEvent>();
  for (const ev of events) {
    const existing = byId.get(ev.id);
    if (!existing || ev.priority < existing.priority) {
      byId.set(ev.id, ev);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

export function hasDuplicateCallbackSignal(
  webhooks: Array<{ attemptCount: number }>
): boolean {
  return webhooks.some((w) => w.attemptCount > 1);
}

export const WEBHOOK_SAFE_SELECT = {
  id: true,
  eventKey: true,
  signatureValid: true,
  processingStatus: true,
  receivedAt: true,
  createdAt: true,
  processedAt: true,
  lastError: true,
  sourceIp: true,
  attemptCount: true,
  merchantOid: true,
} as const;

export function serializeWebhookEvent(row: {
  id: string;
  eventKey: string;
  signatureValid: boolean;
  processingStatus: string;
  receivedAt: Date;
  createdAt: Date;
  processedAt: Date | null;
  lastError: string | null;
  sourceIp: string | null;
  attemptCount: number;
  merchantOid: string;
}) {
  return {
    id: row.id,
    eventKeyMasked: maskEventKey(row.eventKey),
    signatureValid: row.signatureValid,
    processingStatus: row.processingStatus,
    receivedAt: row.receivedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
    lastError: row.lastError,
    sourceIpMasked: maskIp(row.sourceIp),
    attemptCount: row.attemptCount,
    merchantOidMasked:
      row.merchantOid.length > 8
        ? row.merchantOid.slice(0, 4) + "…" + row.merchantOid.slice(-4)
        : "****",
  };
}
