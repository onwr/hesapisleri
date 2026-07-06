import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { getMobileEmployeeDetail, updateMobileEmployee } from "@/lib/mobile/mobile-employees-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;

    const data = await getMobileEmployeeDetail({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      employeeId: id,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const body = await request.json();

    const data = await updateMobileEmployee({
      companyId,
      actorUserId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      employeeId: id,
      body,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
