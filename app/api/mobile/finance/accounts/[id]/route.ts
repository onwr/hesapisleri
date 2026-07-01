import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { getMobileFinanceAccountById } from "@/lib/mobile/mobile-finance-service";

type Props = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { membership, companyId } = await requireMobileCompanySession(request);
    const data = await getMobileFinanceAccountById({
      companyId,
      role: membership.role,
      isOwner: membership.isOwner,
      accountId: id,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
