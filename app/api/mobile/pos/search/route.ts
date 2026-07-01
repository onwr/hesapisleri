import { searchMobilePosProducts, requireMobilePosSellAccess } from "@/lib/mobile/mobile-pos-service";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobilePosSession(request);
    await requireMobilePosSellAccess(session, membership);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

    const data = await searchMobilePosProducts({
      companyId,
      q,
      cursor,
      warehouseId,
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
