import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, _context: RouteContext) {
  const auth = await requireSuperAdminApi();
  if ("error" in auth) return auth.error;

  return NextResponse.json(
    {
      success: false,
      message:
        "Ödeme durumu doğrudan değiştirilemez. Yalnızca doğrulanmış callback, provider sync veya güvenli iade servisi kullanılabilir.",
      code: "PAYMENT_STATUS_MUTATION_DISABLED",
    },
    { status: 405, headers: { Allow: "GET" } }
  );
}
