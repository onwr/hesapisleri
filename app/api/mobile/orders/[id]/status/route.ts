import { z } from "zod";
import { updateMobileOrderStatus } from "@/lib/mobile/mobile-orders-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";

const statusSchema = z.object({
  status: z.enum([
    "WAITING",
    "APPROVED",
    "SHIPPING",
    "DELIVERED",
    "RETURN_REQUESTED",
    "RETURNED",
    "CANCELLED",
  ]),
  note: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "orders", "write");

    const { id } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new MobilePosError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Geçersiz istek.",
        400
      );
    }

    const order = await updateMobileOrderStatus({
      companyId,
      userId: session.userId,
      orderId: id,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    return mobilePosJson({ success: true, order });
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
