import { db } from "@/lib/prisma";
import { writeLifecycleActivityLog } from "@/lib/transaction-lifecycle-enforcement";
import { formatOrderNo } from "@/lib/order-utils";

type ServiceResult<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; status: number; message: string };

function isMarketplaceChannel(sourceChannel: string) {
  return (
    sourceChannel === "TRENDYOL" ||
    sourceChannel === "HEPSIBURADA" ||
    sourceChannel === "N11" ||
    sourceChannel === "AMAZON"
  );
}

export async function archiveOrder(input: {
  companyId: string;
  orderId: string;
  userId: string;
  reason?: string;
}): Promise<ServiceResult<{ id: string; archivedAt: Date }>> {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: input.orderId, companyId: input.companyId },
      select: {
        id: true,
        saleNo: true,
        sourceChannel: true,
        orderStatus: true,
        archivedAt: true,
      },
    });

    if (!sale) {
      return { ok: false as const, status: 404, message: "Sipariş bulunamadı." };
    }

    if (sale.archivedAt) {
      return {
        ok: true as const,
        data: { id: sale.id, archivedAt: sale.archivedAt },
        message: "Sipariş zaten arşivlenmiş.",
      };
    }

    if (sale.orderStatus === "CANCELLED") {
      return {
        ok: false as const,
        status: 400,
        message: "İptal edilmiş sipariş arşivlenemez.",
      };
    }

    const archivedAt = new Date();
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: {
        archivedAt,
        archivedByUserId: input.userId,
      },
      select: { id: true, archivedAt: true },
    });

    const orderLabel = formatOrderNo(sale.saleNo);
    const channelNote = isMarketplaceChannel(sale.sourceChannel)
      ? " Pazaryeri siparişi yalnızca yerel listeden arşivlendi."
      : "";

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "orders",
      entityType: "order",
      entityId: sale.id,
      action: "ORDER_ARCHIVE",
      message: `${orderLabel} siparişi arşivlendi.${channelNote}`,
      reason: input.reason,
    });

    return {
      ok: true as const,
      data: { id: updated.id, archivedAt: updated.archivedAt! },
      message: "Sipariş arşivlendi.",
    };
  });
}

export async function restoreOrder(input: {
  companyId: string;
  orderId: string;
  userId: string;
}): Promise<ServiceResult<{ id: string }>> {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: input.orderId, companyId: input.companyId },
      select: {
        id: true,
        saleNo: true,
        archivedAt: true,
      },
    });

    if (!sale) {
      return { ok: false as const, status: 404, message: "Sipariş bulunamadı." };
    }

    if (!sale.archivedAt) {
      return {
        ok: false as const,
        status: 400,
        message: "Sipariş arşivde değil.",
      };
    }

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        archivedAt: null,
        archivedByUserId: null,
      },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "orders",
      entityType: "order",
      entityId: sale.id,
      action: "ORDER_RESTORE",
      message: `${formatOrderNo(sale.saleNo)} siparişi arşivden çıkarıldı.`,
    });

    return {
      ok: true as const,
      data: { id: sale.id },
      message: "Sipariş arşivden çıkarıldı.",
    };
  });
}
