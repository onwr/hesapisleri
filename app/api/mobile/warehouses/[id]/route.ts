import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { getMobileWarehouseDetail } from "@/lib/mobile/mobile-stocks-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "products", "read");
    const { id } = await params;
    const url = new URL(request.url);

    const data = await getMobileWarehouseDetail({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      warehouseId: id,
      q: url.searchParams.get("q") ?? undefined,
      lowStock: url.searchParams.get("lowStock") === "true",
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
