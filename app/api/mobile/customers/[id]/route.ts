import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  getMobileCustomerById,
  updateMobileCustomer,
} from "@/lib/mobile/mobile-customers-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "customers", "read");
    const { id } = await params;

    const data = await getMobileCustomerById({
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

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "customers", "write");
    const { id } = await params;

    const body = await request.json();
    const data = await updateMobileCustomer({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      customerId: id,
      body,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
