import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { cancelWarehouseTransfer } from "@/lib/warehouse-service";

type Props = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("stocks");
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const result = await cancelWarehouseTransfer(
      auth.companyId,
      auth.userId,
      id
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transfer iptal edildi.",
      data: result.data,
    });
  } catch (error) {
    console.error("STOCKS_TRANSFER_CANCEL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transfer iptal edilemedi." },
      { status: 500 }
    );
  }
}
