import "server-only";

import { db } from "@/lib/prisma";
import { decryptPaymentToken } from "@/lib/payments/payment-token-crypto";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";

export function serializePaymentMethod(method: {
  id: string;
  displayName: string | null;
  cardBrand: string | null;
  cardFamily: string | null;
  bankName: string | null;
  maskedPan: string | null;
  lastFour: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  status: string;
}) {
  return {
    id: method.id,
    displayName: method.displayName,
    brand: method.cardBrand ?? method.cardFamily ?? null,
    bankName: method.bankName,
    maskedPan: method.maskedPan,
    lastFour: method.lastFour,
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    isDefault: method.isDefault,
    status: method.status,
  };
}

export async function listCompanyPaymentMethods(companyId: string) {
  const methods = await db.companyPaymentMethod.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return methods.map(serializePaymentMethod);
}

export async function setDefaultPaymentMethod(input: {
  companyId: string;
  paymentMethodId: string;
}) {
  const method = await db.companyPaymentMethod.findFirst({
    where: {
      id: input.paymentMethodId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
  });

  if (!method) {
    throw new Error("Ödeme yöntemi bulunamadı.");
  }

  await db.$transaction(async (tx) => {
    await tx.companyPaymentMethod.updateMany({
      where: { companyId: input.companyId },
      data: { isDefault: false },
    });
    await tx.companyPaymentMethod.update({
      where: { id: method.id },
      data: { isDefault: true },
    });
    await tx.companySubscription.updateMany({
      where: { companyId: input.companyId },
      data: { defaultPaymentMethodId: method.id },
    });
  });

  return serializePaymentMethod({ ...method, isDefault: true });
}

export async function revokePaymentMethod(input: {
  companyId: string;
  paymentMethodId: string;
}) {
  const method = await db.companyPaymentMethod.findFirst({
    where: { id: input.paymentMethodId, companyId: input.companyId },
  });

  if (!method) throw new Error("Ödeme yöntemi bulunamadı.");

  const subscription = await db.companySubscription.findUnique({
    where: { companyId: input.companyId },
  });

  if (
    subscription?.autoRenew &&
    subscription.defaultPaymentMethodId === method.id
  ) {
    const activeCount = await db.companyPaymentMethod.count({
      where: { companyId: input.companyId, status: "ACTIVE" },
    });
    if (activeCount <= 1) {
      throw new Error(
        "Otomatik yenileme açıkken tek kayıtlı kart silinemez. Önce yeni kart ekleyin veya otomatik yenilemeyi kapatın."
      );
    }
  }

  const adapter = createPaytrAdapter();
  await adapter.deletePaymentMethod({
    externalUserToken: decryptPaymentToken(method.externalUserTokenEncrypted),
    externalCardToken: decryptPaymentToken(method.externalCardTokenEncrypted),
  });

  await db.companyPaymentMethod.update({
    where: { id: method.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      providerDeletedAt: new Date(),
      isDefault: false,
    },
  });
}
