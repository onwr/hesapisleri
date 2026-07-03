import { z } from "zod";
import { cancelMobileSale } from "@/lib/mobile/mobile-sales-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "İptal nedeni zorunludur.").max(500),
  note: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "sales", "delete");

    const { id } = await context.params;
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobilePosError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "İptal nedeni zorunludur.",
        400
      );
    }

    const data = await cancelMobileSale({
      companyId,
      userId: session.userId,
      saleId: id,
      reason: parsed.data.reason,
      note: parsed.data.note,
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
