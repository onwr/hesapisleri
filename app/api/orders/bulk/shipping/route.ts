import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { bulkUpdateOrderShipping } from "@/lib/order-service";

const schema = z.object({
  ids: z.array(z.string()).min(1),
  shippingCarrier: z.string().trim().min(1),
  trackingNumber: z.string().trim().min(1),
  shippedAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz kargo bilgileri." },
        { status: 400 }
      );
    }

    const result = await bulkUpdateOrderShipping({
      companyId: auth.companyId,
      userId: auth.userId,
      ids: parsed.data.ids,
      shippingCarrier: parsed.data.shippingCarrier,
      trackingNumber: parsed.data.trackingNumber,
      shippedAt: parsed.data.shippedAt,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${result.data.updatedCount} siparişe kargo bilgisi eklendi.`,
      data: result.data,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Toplu kargo güncellemesi başarısız." },
      { status: 500 }
    );
  }
}
