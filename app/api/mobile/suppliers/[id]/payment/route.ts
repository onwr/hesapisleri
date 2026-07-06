import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { payMobileSupplier } from "@/lib/mobile/mobile-suppliers-service";
import { invalidateTenantCaches } from "@/lib/tenant-cache/tenant-cache-invalidation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const body = await request.json();

    const data = await payMobileSupplier({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      supplierId: id,
      body,
    });

    invalidateTenantCaches(companyId, {
      reason: "supplier-payment",
      entityIds: { supplierId: id },
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
