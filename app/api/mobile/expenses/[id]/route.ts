import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import {
  getMobileExpenseById,
  updateMobileExpense,
} from "@/lib/mobile/mobile-expenses-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "expenses", "read");
    const data = await getMobileExpenseById({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      expenseId: id,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "expenses", "write");
    const body = await request.json();
    const data = await updateMobileExpense({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      expenseId: id,
      body,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
