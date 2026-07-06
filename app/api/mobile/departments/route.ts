import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { listMobileDepartments } from "@/lib/mobile/mobile-employees-service";

export async function GET(request: Request) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);

    const data = await listMobileDepartments({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
    });

    return mobileJson({ items: data });
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
