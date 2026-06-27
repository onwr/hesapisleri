import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getAdminUserList,
  getAdminUsersSummaryExtended,
} from "@/lib/admin/users/admin-user-list-service";
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

    const [list, summary] = await Promise.all([
      getAdminUserList(parsed.data),
      getAdminUsersSummaryExtended(),
    ]);

    return NextResponse.json({ success: true, data: { list, summary } });
  } catch (error) {
    console.error("ADMIN_USERS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kullanıcılar yüklenemedi." },
      { status: 500 }
    );
  }
}
