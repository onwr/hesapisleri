import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { createMobileCollection } from "@/lib/mobile/mobile-collections-service";

export async function POST(request: Request) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "invoices", "write");
    const body = await request.json();
    const data = await createMobileCollection({
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
