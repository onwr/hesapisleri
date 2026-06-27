import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminServiceError, updateAdminCompany } from "@/lib/admin-service";
import {
  getAdminCompanyActivityTab,
  getAdminCompanyHeader,
  getAdminCompanyIntegrationsTab,
  getAdminCompanyOverviewTab,
  getAdminCompanyPaymentsTab,
  getAdminCompanySubscriptionTab,
  getAdminCompanyUsageTab,
  getAdminCompanyUsersTab,
} from "@/lib/admin/companies/admin-company-detail-service";
import type { AdminCompanyTab } from "@/lib/admin/companies/admin-company-detail-service";

type RouteContext = { params: Promise<{ id: string }> };

const TABS: AdminCompanyTab[] = [
  "overview",
  "users",
  "subscription",
  "payments",
  "usage",
  "integrations",
  "activity",
  "notes",
];

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") ?? "overview") as AdminCompanyTab;

    const header = await getAdminCompanyHeader(id);
    if (!header) {
      return NextResponse.json(
        { success: false, message: "Firma bulunamadı." },
        { status: 404 }
      );
    }

    let tabData: unknown = null;
    if (tab === "overview") tabData = await getAdminCompanyOverviewTab(id);
    else if (tab === "users") tabData = await getAdminCompanyUsersTab(id);
    else if (tab === "subscription")
      tabData = await getAdminCompanySubscriptionTab(id);
    else if (tab === "payments")
      tabData = await getAdminCompanyPaymentsTab(
        id,
        Number(searchParams.get("page") ?? 1)
      );
    else if (tab === "usage") tabData = await getAdminCompanyUsageTab(id);
    else if (tab === "integrations")
      tabData = await getAdminCompanyIntegrationsTab(id);
    else if (tab === "activity")
      tabData = await getAdminCompanyActivityTab(id, {
        page: Number(searchParams.get("page") ?? 1),
        module: searchParams.get("module") ?? undefined,
        action: searchParams.get("action") ?? undefined,
        q: searchParams.get("q") ?? undefined,
      });
    else if (tab === "notes") {
      const { listAdminCompanyNotes } = await import(
        "@/lib/admin/companies/admin-company-note-service"
      );
      tabData = await listAdminCompanyNotes(id);
    }

    if (!TABS.includes(tab)) {
      return NextResponse.json(
        { success: false, message: "Geçersiz sekme." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { header, tab, tabData },
    });
  } catch (error) {
    console.error("ADMIN_COMPANY_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Firma detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const data = await updateAdminCompany(id, auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Firma güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_COMPANY_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Firma güncellenemedi." },
      { status: 500 }
    );
  }
}
