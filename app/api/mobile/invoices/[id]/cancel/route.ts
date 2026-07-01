import {
  handleMobileRouteError,
  mobileJson,
  requireMobileCompanySession,
} from "@/lib/mobile/mobile-route-utils";
import { requireMobilePermission } from "@/lib/mobile/mobile-auth-guards";
import { cancelMobileInvoice } from "@/lib/mobile/mobile-invoices-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { id } = await params;
    const { session, membership, companyId } = await requireMobileCompanySession(request);
    await requireMobilePermission(session, "invoices", "delete");
    const data = await cancelMobileInvoice({
      companyId,
      userId: session.userId,
      role: membership.role,
      isOwner: membership.isOwner,
      invoiceId: id,
    });
    return mobileJson(data);
  } catch (err) {
    return handleMobileRouteError(err);
  }
}
