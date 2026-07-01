import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { listMobilePendingCollections } from "@/lib/mobile/mobile-collections-service";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "invoices", "read");
    const url = new URL(request.url);
    const data = await listMobilePendingCollections({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      q: url.searchParams.get("q") ?? undefined,
      customerId: url.searchParams.get("customerId") ?? undefined,
      dueStatus: url.searchParams.get("dueStatus") ?? undefined,
      overdue: url.searchParams.get("overdue") === "1",
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
