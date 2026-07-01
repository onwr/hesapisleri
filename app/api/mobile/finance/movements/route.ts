import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileFinanceMovements } from "@/lib/mobile/mobile-finance-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const url = new URL(request.url);
    const data = await listMobileFinanceMovements({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      accountId: url.searchParams.get("accountId") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
