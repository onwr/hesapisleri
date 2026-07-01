import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { archiveMobileCustomer } from "@/lib/mobile/mobile-customers-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "customers", "write");
    const { id } = await params;

    const data = await archiveMobileCustomer({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      customerId: id,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
