import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import { resolveEffectiveRole } from "@/lib/permission-utils";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("pos");
    if ("error" in auth) return auth.error;

    const { companyId, userId } = auth;

    const membership = await db.companyUser.findFirst({
      where: { companyId, userId, status: "ACTIVE" },
      select: { role: true, isOwner: true },
    });

    const effectiveRole = resolveEffectiveRole({
      role: membership?.role ?? "STAFF",
      isOwner: membership?.isOwner ?? false,
    });

    const todayStart = startOfDay(new Date());

    const salesWhere = {
      companyId,
      sourceChannel: "POS" as const,
      status: "COMPLETED" as const,
      createdAt: { gte: todayStart },
      ...(effectiveRole === "POS_STAFF" ? { userId } : {}),
    };

    const [salesAgg, cashAgg] = await Promise.all([
      db.sale.aggregate({
        where: salesWhere,
        _count: { _all: true },
        _sum: { total: true },
      }),
      db.account.aggregate({
        where: { companyId, type: "CASH", status: "ACTIVE" },
        _sum: { balance: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        todaySalesCount: salesAgg._count._all,
        todaySalesTotal: Number(salesAgg._sum.total ?? 0),
        cashBalanceTotal: Number(cashAgg._sum.balance ?? 0),
      },
    });
  } catch (error) {
    console.error("POS_STATS_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "POS istatistikleri alınamadı.",
      },
      { status: 500 }
    );
  }
}
