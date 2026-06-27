import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminUserDetail } from "@/lib/admin-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminUserDetail(id);

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_USER_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcı detayı yüklenemedi." },
      { status: 500 }
    );
  }
}

// PATCH kasıtlı olarak kaldırıldı.
// Kullanıcı durumu /suspend ve /reactivate endpointlerinden değiştirilir.
// Platform rol değişikliği ayrı bir güvenlik fazında ele alınacak.
export async function PATCH() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Bu endpoint kullanıcı güncellemesi için kullanılamaz. Durum için /suspend veya /reactivate kullanın.",
    },
    { status: 405 }
  );
}
