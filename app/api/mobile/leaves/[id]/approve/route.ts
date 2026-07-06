import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { approveMobileEmployeeLeave } from "@/lib/mobile/mobile-employees-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;

    const data = await approveMobileEmployeeLeave({
      companyId,
      actorUserId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      leaveId: id,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
