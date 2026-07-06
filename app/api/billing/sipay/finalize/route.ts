import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import { getAppSession } from "@/lib/app-session";
import { canManageMembership } from "@/lib/permission-utils";
import {
  MembershipServiceError,
  assertCanManageActiveCompanyBilling,
} from "@/lib/membership-service";
import { db } from "@/lib/prisma";
import { finalizeSipayPayment } from "@/lib/payments/sipay/sipay-checkout-service";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FINALIZE_RATE_LIMIT_WINDOW_MS = 60_000;
const FINALIZE_RATE_LIMIT_MAX = 30;

const finalizeSchema = z.object({
  invoiceId: z.string().min(1),
});

function buildFinalizeRateLimitKey(input: {
  userId: string;
  companyId: string;
  ip: string;
}): string {
  return `sipay-finalize:${input.userId}:${input.companyId}:${input.ip}`;
}

export async function POST(request: Request) {
  try {
    const originError = verifyApiMutationOrigin(request);
    if (originError) return originError;

    const session = await getAppSession();
    if (!canManageMembership(session.effectiveRole, session.companyUser.isOwner)) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 },
      );
    }

    await assertCanManageActiveCompanyBilling({
      userId: session.user.id,
      activeCompanyId: session.company.id,
    });

    const rate = await checkRateLimitAsync({
      key: buildFinalizeRateLimitKey({
        userId: session.user.id,
        companyId: session.company.id,
        ip: getTrustedClientIp(request),
      }),
      limit: FINALIZE_RATE_LIMIT_MAX,
      windowMs: FINALIZE_RATE_LIMIT_WINDOW_MS,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: "Çok fazla istek. Lütfen kısa süre sonra tekrar deneyin." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const parsed = finalizeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek." },
        { status: 400 },
      );
    }

    const attempt = await db.paymentAttempt.findFirst({
      where: {
        invoiceId: parsed.data.invoiceId,
        companyId: session.company.id,
        provider: "SIPAY",
      },
      select: { status: true },
    });

    if (!attempt) {
      return NextResponse.json(
        { success: false, message: "Ödeme kaydı bulunamadı." },
        { status: 404 },
      );
    }

    const result = await finalizeSipayPayment(parsed.data.invoiceId, "return", {
      companyId: session.company.id,
      userId: session.user.id,
    });

    const refreshed = await db.paymentAttempt.findFirst({
      where: { invoiceId: parsed.data.invoiceId, companyId: session.company.id },
      select: { status: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        invoiceId: parsed.data.invoiceId,
        status: refreshed?.status ?? attempt.status,
        duplicate: result.duplicate,
        verificationPending: Boolean(result.verificationPending),
        membershipPaymentId: result.membershipPaymentId ?? null,
        completed: refreshed?.status === "COMPLETED" || Boolean(result.membershipPaymentId),
      },
    });
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    console.error("[sipay-finalize] error", error instanceof Error ? error.message : "unknown");

    return NextResponse.json(
      { success: false, message: "Ödeme durumu doğrulanamadı." },
      { status: 500 },
    );
  }
}
