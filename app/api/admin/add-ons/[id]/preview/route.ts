import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AddOnServiceError, previewAddOnPrice } from "@/lib/admin/addons";
import { adminAddonPreviewSchema } from "@/lib/admin/addons/admin-addon-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const parsed = adminAddonPreviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz önizleme isteği." },
        { status: 400 }
      );
    }

    const preview = await previewAddOnPrice(id, parsed.data);

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    if (error instanceof AddOnServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Fiyat önizlemesi yapılamadı." },
      { status: 500 }
    );
  }
}
