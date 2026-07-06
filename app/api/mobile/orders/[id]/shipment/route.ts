import { z } from "zod";
import { addMobileOrderShipment } from "@/lib/mobile/mobile-orders-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";

const shipmentSchema = z.object({
  carrier: z.string().trim().min(1, "Kargo firması zorunludur.").max(120),
  trackingNumber: z.string().trim().min(1, "Takip numarası zorunludur.").max(120),
  shippedAt: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "orders", "write");

    const { id } = await context.params;
    const parsed = shipmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new MobilePosError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Geçersiz kargo bilgisi.",
        400
      );
    }

    const order = await addMobileOrderShipment({
      companyId,
      userId: session.userId,
      orderId: id,
      carrier: parsed.data.carrier,
      trackingNumber: parsed.data.trackingNumber,
      shippedAt: parsed.data.shippedAt,
    });

    return mobilePosJson({ success: true, order });
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
