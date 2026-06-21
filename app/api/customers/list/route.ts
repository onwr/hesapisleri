import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";
export async function GET() {
  try {
    const auth = await requireApiModuleAccess("customers");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const customers = await db.customer.findMany({
      where: {
        companyId: companyId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("CUSTOMER_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteriler alınamadı.",
      },
      { status: 500 }
    );
  }
}
