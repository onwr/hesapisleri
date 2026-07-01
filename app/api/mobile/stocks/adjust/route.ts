import { z } from "zod";
import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { adjustMobileStock } from "@/lib/mobile/mobile-stocks-service";
import { MobileCatalogError } from "@/lib/mobile/mobile-catalog-errors";

const adjustSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().optional(),
  type: z.enum(["IN", "OUT", "SET"]),
  quantity: z.number().finite().positive(),
  note: z.string().optional(),
  movementDate: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "write");

    const body = await request.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      throw new MobileCatalogError(
        "INVALID_STOCK_QUANTITY",
        parsed.error.issues[0]?.message ?? "Geçersiz istek.",
        400
      );
    }

    const data = await adjustMobileStock({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      ...parsed.data,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
