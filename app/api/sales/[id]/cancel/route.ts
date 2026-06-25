import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSalesAction } from "@/lib/module-access";
import { cancelSaleById } from "@/lib/sale-cancel-service";

type Props = {
  params: Promise<{ id: string }>;
};

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "İptal nedeni zorunludur."),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiSalesAction("cancel");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .find(Boolean);

      return NextResponse.json(
        {
          success: false,
          message: firstError || "Geçersiz istek.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await cancelSaleById(
      id,
      auth.companyId,
      auth.userId,
      parsed.data
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("SALE_CANCEL_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Satış iptal edilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
