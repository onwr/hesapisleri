import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { bulkUpdateOrderStatus } from "@/lib/order-service";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  orderStatus: z.enum([
    "WAITING",
    "APPROVED",
    "SHIPPING",
    "DELIVERED",
    "RETURN_REQUESTED",
    "RETURNED",
    "CANCELLED",
  ]),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz toplu işlem verisi." },
        { status: 400 }
      );
    }

    const result = await bulkUpdateOrderStatus({
      companyId: auth.companyId,
      userId: auth.userId,
      ids: parsed.data.ids,
      orderStatus: parsed.data.orderStatus,
    });

    return NextResponse.json({
      success: true,
      message: `${result.updatedCount} sipariş güncellendi.`,
      data: result,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Toplu durum güncellemesi başarısız." },
      { status: 500 }
    );
  }
}
