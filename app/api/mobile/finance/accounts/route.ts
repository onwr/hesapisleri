import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileFinanceAccounts } from "@/lib/mobile/mobile-finance-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const data = await listMobileFinanceAccounts({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
