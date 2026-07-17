import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSalesAction } from "@/lib/module-access";
import {
  createSaleReturn,
  SaleReturnError,
} from "@/lib/sale-return-service";

type Props = {
  params: Promise<{ id: string }>;
};

const returnLineSchema = z.object({
  saleItemId: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  restock: z.boolean().optional(),
  note: z.string().optional().nullable(),
});

const returnSchema = z.object({
  reason: z.string().trim().min(1, "İade nedeni zorunludur."),
  note: z.string().optional().nullable(),
  refundMethod: z.enum(["CASH", "CARD", "CREDIT"]),
  accountId: z.string().trim().optional().nullable(),
  lines: z.array(returnLineSchema).min(1, "En az bir ürün iade edilmelidir."),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiSalesAction("return");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = returnSchema.safeParse(body);

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

    const result = await createSaleReturn({
      companyId: auth.companyId,
      userId: auth.userId,
      saleId: id,
      reason: parsed.data.reason,
      note: parsed.data.note,
      refundMethod: parsed.data.refundMethod,
      accountId: parsed.data.accountId,
      lines: parsed.data.lines,
    });

    return NextResponse.json({
      success: true,
      message: "İade kaydı oluşturuldu.",
      data: {
        returnId: result.saleReturn.id,
        returnNo: result.saleReturn.returnNo,
        saleStatus: result.nextStatus,
        totalReturnAmount: Number(result.saleReturn.totalReturnAmount),
      },
    });
  } catch (error) {
    if (error instanceof SaleReturnError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SALE_RETURN_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Satış iadesi kaydedilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
