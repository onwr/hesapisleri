import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminSubListQuerySchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import { getAdminSubscriptionList, exportAdminSubscriptionsCsv } from "@/lib/admin/subscriptions/admin-subscription-list-service";
import { getAdminSubscriptionMetrics } from "@/lib/admin/subscriptions/admin-subscription-metric-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const rawQuery = Object.fromEntries(searchParams.entries());

    if (rawQuery.export === "csv") {
      const parsed = adminSubListQuerySchema.safeParse({ ...rawQuery, pageSize: 1000 });
      if (!parsed.success) return NextResponse.json({ success: false, message: "Geçersiz sorgu." }, { status: 400 });
      const csv = await exportAdminSubscriptionsCsv(parsed.data);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="subscriptions-${Date.now()}.csv"`,
        },
      });
    }

    const parsed = adminSubListQuerySchema.safeParse(rawQuery);
    if (!parsed.success) return NextResponse.json({ success: false, message: "Geçersiz sorgu parametreleri." }, { status: 400 });

    const [list, metrics] = await Promise.all([
      getAdminSubscriptionList(parsed.data),
      getAdminSubscriptionMetrics(),
    ]);

    return NextResponse.json({ success: true, data: { list, metrics } });
  } catch (err) {
    console.error("[GET /api/admin/subscriptions]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
