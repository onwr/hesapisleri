import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { listMobileLowStock } from "@/lib/mobile/mobile-stocks-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "read");

    const url = new URL(request.url);
    const data = await listMobileLowStock({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      warehouseId: url.searchParams.get("warehouseId") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
