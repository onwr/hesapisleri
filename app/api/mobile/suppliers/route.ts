import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileSuppliers } from "@/lib/mobile/mobile-suppliers-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const url = new URL(request.url);
    const data = await listMobileSuppliers({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
