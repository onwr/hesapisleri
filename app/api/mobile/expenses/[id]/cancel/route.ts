import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { cancelMobileExpense } from "@/lib/mobile/mobile-expenses-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "expenses", "delete");
    const data = await cancelMobileExpense({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      expenseId: id,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
