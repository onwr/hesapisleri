import {
  getMobilePosBootstrap,
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
    const data = await getMobilePosBootstrap(
      companyId,
      membership.role,
      membership.isOwner
    );
    return mobilePosJson(data);
  } catch (err) {
    return handleMobilePosRouteError(err);
  }
}
