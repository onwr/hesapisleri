import {
  resolveMobilePosPermissions,
  searchMobilePosCustomers,
  requireMobilePosSellAccess,
} from "@/lib/mobile/mobile-pos-service";
import {
  handleMobilePosRouteError,
  mobilePosJson,
  requireMobilePosSession,
} from "@/lib/mobile/mobile-pos-route-utils";

export async function GET(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobilePosSession(request);
    await requireMobilePosSellAccess(session, membership);

    const permissions = resolveMobilePosPermissions(
      membership.role,
      membership.isOwner
    );

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const data = await searchMobilePosCustomers({
      companyId,
      q,
      cursor,
      canViewBalance: permissions.canViewCustomerBalance,
    });

    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
