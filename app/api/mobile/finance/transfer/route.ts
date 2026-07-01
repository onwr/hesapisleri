import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { transferMobileFinance } from "@/lib/mobile/mobile-finance-service";

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const body = await request.json();
    const data = await transferMobileFinance({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      body,
    });
    return mobileJson(data, 201);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
