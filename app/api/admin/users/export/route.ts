import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { exportAdminUsersAsCsv } from "@/lib/admin/users/admin-user-list-service";
import { adminUserListQuerySchema } from "@/lib/admin/users/admin-user-schemas";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const rawQuery = Object.fromEntries(searchParams.entries());
    const parsed = adminUserListQuerySchema.safeParse(rawQuery);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz sorgu parametreleri." },
        { status: 400 }
      );
    }

    const csv = await exportAdminUsersAsCsv(parsed.data);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kullanicilar-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("ADMIN_USERS_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "CSV dışa aktarım başarısız." },
      { status: 500 }
    );
  }
}
