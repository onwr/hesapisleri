import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getAdminSubscriptionHeader,
  getSubscriptionOverviewTab,
  getSubscriptionPaymentsTab,
  getSubscriptionHistoryTab,
  getSubscriptionAddonsTab,
  getSubscriptionActivityTab,
} from "@/lib/admin/subscriptions/admin-subscription-detail-service";
import { getSubscriptionEntitlementsTab } from "@/lib/admin/subscriptions/admin-subscription-entitlement-service";
import { getAdminSubscriptionNotes } from "@/lib/admin/subscriptions/admin-subscription-note-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "overview";

    const header = await getAdminSubscriptionHeader(id);
    if (!header) {
      return NextResponse.json({ success: false, message: "Abonelik bulunamadı" }, { status: 404 });
    }

    let tabData: unknown = null;
    switch (tab) {
      case "overview":
        tabData = await getSubscriptionOverviewTab(id);
        break;
      case "payments": {
        const page = Number(searchParams.get("page") ?? "1");
        tabData = await getSubscriptionPaymentsTab(id, page, 30, {
          status: searchParams.get("status") ?? undefined,
          provider: searchParams.get("provider") ?? undefined,
          dateFrom: searchParams.get("dateFrom") ?? undefined,
          dateTo: searchParams.get("dateTo") ?? undefined,
          refundStatus: searchParams.get("refundStatus") ?? undefined,
        });
        break;
      }
      case "history":
        tabData = await getSubscriptionHistoryTab(id);
        break;
      case "entitlements":
        tabData = await getSubscriptionEntitlementsTab(id, header.companyId);
        break;
      case "addons":
        tabData = await getSubscriptionAddonsTab(id);
        break;
      case "activity": {
        const page = Number(searchParams.get("page") ?? "1");
        tabData = await getSubscriptionActivityTab(id, header.companyId, page, 30, {
          action: searchParams.get("action") ?? undefined,
          source: searchParams.get("source") ?? undefined,
          success: (searchParams.get("success") as "success" | "error" | null) ?? undefined,
          dateFrom: searchParams.get("dateFrom") ?? undefined,
          dateTo: searchParams.get("dateTo") ?? undefined,
        });
        break;
      }
      case "notes":
        tabData = await getAdminSubscriptionNotes(id);
        break;
      default:
        tabData = await getSubscriptionOverviewTab(id);
    }

    return NextResponse.json({ success: true, data: { header, tab, tabData } });
  } catch (err) {
    console.error("[GET /api/admin/subscriptions/[id]]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
