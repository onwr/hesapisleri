import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { rejectMobileEmployeeLeave } from "@/lib/mobile/mobile-employees-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    const { id } = await context.params;
    const body = await request.json();

    const data = await rejectMobileEmployeeLeave({
      companyId,
      actorUserId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      leaveId: id,
      body,
    });

    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
