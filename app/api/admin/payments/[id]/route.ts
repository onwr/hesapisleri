import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getAdminPaymentHeader,
  getPaymentOverviewTab,
  getPaymentProviderTab,
  getPaymentSubscriptionTab,
  getPaymentRefundsTab,
  getPaymentEventsTab,
  getPaymentActivityTab,
  getPaymentNotesTab,
} from "@/lib/admin/payments/admin-payment-detail-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "overview";

    const header = await getAdminPaymentHeader(id);
    if (!header) {
      return NextResponse.json({ success: false, message: "Ödeme bulunamadı" }, { status: 404 });
    }

    let tabData: unknown = null;
    switch (tab) {
      case "overview":
        tabData = await getPaymentOverviewTab(id);
        break;
      case "provider":
        tabData = await getPaymentProviderTab(id);
        break;
      case "subscription":
        tabData = await getPaymentSubscriptionTab(id);
        break;
      case "refunds":
        tabData = await getPaymentRefundsTab(id, true);
        break;
      case "events":
        tabData = await getPaymentEventsTab(id);
        break;
      case "activity": {
        const page = Number(searchParams.get("page") ?? "1");
        tabData = await getPaymentActivityTab(id, page, 30);
        break;
      }
      case "notes":
        tabData = await getPaymentNotesTab(id);
        break;
      default:
        tabData = await getPaymentOverviewTab(id);
    }

    return NextResponse.json({ success: true, data: { header, tab, tabData } });
  } catch (err) {
    console.error("[GET /api/admin/payments/[id]]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
