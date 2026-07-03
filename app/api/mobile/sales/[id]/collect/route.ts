import { z } from "zod";
import { collectMobileSalePayment } from "@/lib/mobile/mobile-sales-service";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";
import { MobilePosError } from "@/lib/mobile/mobile-pos-errors";

const collectSchema = z.object({
  amount: z.number().positive(),
  accountId: z.string().trim().min(1, "Hesap seçilmelidir."),
  paidAt: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, companyId } = await requireMobilePosSession(request);
    await requireMobilePermission(session, "sales", "write");

    const { id } = await context.params;
    const body = await request.json();
    const parsed = collectSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobilePosError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin.",
        400
      );
    }

    const data = await collectMobileSalePayment({
      companyId,
      userId: session.userId,
      saleId: id,
      amount: parsed.data.amount,
      accountId: parsed.data.accountId,
      paidAt: parsed.data.paidAt,
      note: parsed.data.note,
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
