import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export { GET } from "@/app/api/admin/partner-applications/[id]/route";

export async function PATCH(_req: Request, _context: RouteContext) {
  return NextResponse.json(
    {
      success: false,
      message:
        "Generic PATCH desteklenmiyor. POST /api/admin/partner-applications/[id]/approve veya /reject kullanın.",
    },
    { status: 405 }
  );
}
