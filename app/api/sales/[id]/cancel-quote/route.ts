import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { isQuoteSaleStatus } from "@/lib/sale-query-utils";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("sales");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: companyId,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Teklif bulunamadı." },
        { status: 404 }
      );
    }

    if (!isQuoteSaleStatus(sale.status)) {
      if (sale.status === "CANCELLED") {
        return NextResponse.json(
          { success: false, message: "Bu teklif zaten iptal edilmiş." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: "Sadece taslak teklifler iptal edilebilir.",
        },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: "CANCELLED",
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: companyId!,
          userId: userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı teklif iptal edildi.`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Teklif iptal edildi.",
    });
  } catch (error) {
    console.error("CANCEL_QUOTE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Teklif iptal edilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
