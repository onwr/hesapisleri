import "server-only";

import { NextResponse } from "next/server";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { db } from "@/lib/prisma";
import { createSipayProvider } from "./sipay-provider";
import {
  finalizeSipayPayment,
  cancelSipayAttempt,
  markSipayVerificationPending,
} from "./sipay-checkout-service";
import { SipayError } from "./sipay-errors";
import { parseSipayWebhookPayload } from "./sipay-webhook-parse";

export const SIPAY_WEBHOOK_MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const ALLOWED_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];

function buildRateLimitKey(request: Request, invoiceId?: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `sipay-webhook:${invoiceId ?? "unknown"}:${ip}`;
}

async function quarantineWebhook(reason: string, invoiceId?: string): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        companyId: "system",
        action: "UPDATE",
        module: "payments",
        message: `[sipay-webhook] quarantine: ${reason}, invoice_id: ${invoiceId ?? "unknown"}`,
      },
    });
  } catch {
    /* best-effort */
  }
}

export async function handleSipayWebhook(request: Request): Promise<NextResponse> {
  if (request.method !== "POST") {
    return NextResponse.json({ message: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > SIPAY_WEBHOOK_MAX_BODY_BYTES) {
    return NextResponse.json({ message: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (ct && !ALLOWED_CONTENT_TYPES.some((allowed) => ct.includes(allowed))) {
    return NextResponse.json({ message: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  let payload: Record<string, string>;
  try {
    payload = await parseSipayWebhookPayload(request);
  } catch {
    return NextResponse.json({ message: "INVALID_BODY" }, { status: 400 });
  }

  if (!payload.invoice_id) {
    await quarantineWebhook("MISSING_INVOICE_ID");
    return NextResponse.json({ message: "QUARANTINED" }, { status: 200 });
  }

  const rate = await checkRateLimitAsync({
    key: buildRateLimitKey(request, payload.invoice_id),
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  try {
    const provider = createSipayProvider();
    const webhookResult = provider.verifyWebhook(payload);
    const { invoiceId, status } = webhookResult;

    const attempt = await db.paymentAttempt.findUnique({ where: { invoiceId } });
    if (!attempt) {
      await quarantineWebhook("UNKNOWN_INVOICE", invoiceId);
      return NextResponse.json({ message: "UNKNOWN_INVOICE" }, { status: 200 });
    }

    if (status === "PAID") {
      try {
        const result = await finalizeSipayPayment(invoiceId, "webhook");
        if (result.verificationPending) {
          return NextResponse.json({ message: "VERIFICATION_PENDING" }, { status: 200 });
        }
        return NextResponse.json({ message: "OK" }, { status: 200 });
      } catch (error) {
        if (error instanceof SipayError && error.code === "CHECKSTATUS_UNAVAILABLE") {
          await markSipayVerificationPending(invoiceId, "webhook");
          return NextResponse.json({ message: "VERIFICATION_PENDING" }, { status: 200 });
        }
        throw error;
      }
    }

    if (status === "FAILED") {
      await cancelSipayAttempt(invoiceId);
      return NextResponse.json({ message: "FAILED_ACK" }, { status: 200 });
    }

    return NextResponse.json({ message: "NOOP" }, { status: 200 });
  } catch (error) {
    if (error instanceof SipayError && error.code === "WEBHOOK_NOT_CONFIGURED") {
      return NextResponse.json({ message: "WEBHOOK_NOT_CONFIGURED" }, { status: 200 });
    }

    if (error instanceof SipayError && error.code === "HASH_INVALID") {
      console.error("[sipay-webhook] hash_invalid for invoice:", payload.invoice_id);
      return NextResponse.json({ message: "INVALID" }, { status: 200 });
    }

    if (error instanceof SipayError && error.code === "WEBHOOK_PAYLOAD_INVALID") {
      await quarantineWebhook("SCHEMA_INVALID", payload.invoice_id);
      return NextResponse.json({ message: "QUARANTINED" }, { status: 200 });
    }

    console.error("[sipay-webhook] error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: "INTERNAL_ERROR" }, { status: 500 });
  }
}
