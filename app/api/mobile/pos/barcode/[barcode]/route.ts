import { lookupMobilePosBarcode, requireMobilePosSellAccess } from "@/lib/mobile/mobile-pos-service";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ barcode: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobilePosSession(request);
    await requireMobilePosSellAccess(session, membership);

    const { barcode } = await context.params;
    const url = new URL(request.url);
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

    const data = await lookupMobilePosBarcode({
      companyId,
      barcode: decodeURIComponent(barcode),
      warehouseId: warehouseId ?? undefined,
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
