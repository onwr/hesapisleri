import "server-only";
import { syncMembershipPaymentWithProvider } from "@/lib/payments/payment-service";
import { db } from "@/lib/prisma";
import { logAdminPaymentAudit } from "@/lib/admin/payments/admin-payment-audit";
import { invalidateAdminPaymentCaches } from "@/lib/admin/payments/admin-payment-cache";

export type AdminPaymentSyncResult =
  | { ok: true; synced: boolean; status: string; message: string; providerStatus?: string | null }
  | { ok: false; code: "NOT_SUPPORTED" | "NOT_FOUND" | "ERROR"; message: string };

export async function adminSyncPaymentWithProvider(input: {
  paymentId: string;
  actorUserId: string;
  force?: boolean;
}): Promise<AdminPaymentSyncResult> {
  const payment = await db.membershipPayment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      companyId: true,
      subscriptionId: true,
      providerEnum: true,
      merchantOid: true,
      status: true,
    },
  });

  if (!payment) {
    return { ok: false, code: "NOT_FOUND", message: "Ödeme bulunamadı." };
  }

  if (payment.providerEnum !== "PAYTR") {
    return {
      ok: false,
      code: "NOT_SUPPORTED",
      message: "Bu provider için otomatik sync desteklenmiyor.",
    };
  }

  if (!payment.merchantOid) {
    return {
      ok: false,
      code: "NOT_SUPPORTED",
      message: "Provider referansı olmadan sync yapılamaz.",
    };
  }

  const beforeStatus = payment.status;

  try {
    const result = await syncMembershipPaymentWithProvider({
      companyId: payment.companyId,
      paymentId: payment.id,
    });

    const after = await db.membershipPayment.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });

    await logAdminPaymentAudit({
      actorUserId: input.actorUserId,
      paymentId: payment.id,
      companyId: payment.companyId,
      subscriptionId: payment.subscriptionId,
      action: "ADMIN_PAYMENT_PROVIDER_SYNC",
      metadata: {
        beforeStatus,
        afterStatus: after?.status ?? result.status,
        synced: result.synced,
        providerStatus: result.providerStatus ?? null,
        force: input.force ?? false,
      },
    });

    invalidateAdminPaymentCaches(payment.id, payment.companyId, payment.subscriptionId ?? undefined);

    return {
      ok: true,
      synced: result.synced,
      status: result.status ?? beforeStatus,
      message: result.message ?? "Sync tamamlandı.",
      providerStatus: result.providerStatus ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      code: "ERROR",
      message: err instanceof Error ? err.message : "Provider sync başarısız.",
    };
  }
}
