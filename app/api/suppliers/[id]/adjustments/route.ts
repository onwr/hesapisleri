import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSupplierManage } from "@/lib/module-access";
import {
  createSupplierAdjustment,
  SupplierFinanceError,
} from "@/lib/supplier-finance-service";
import { invalidateTenantCaches } from "@/lib/tenant-cache/tenant-cache-invalidation";

const bodySchema = z.object({
  amount: z.number().positive(),
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  date: z.string().optional(),
  description: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierManage();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz düzeltme verisi." },
        { status: 400 }
      );
    }

    const entry = await createSupplierAdjustment({
      companyId: auth.companyId,
      supplierId: id,
      userId: auth.userId,
      amount: parsed.data.amount,
      direction: parsed.data.direction,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      description: parsed.data.description,
      reason: parsed.data.reason,
    });

    invalidateTenantCaches(auth.companyId, {
      reason: "supplier-adjustment",
      entityIds: { supplierId: id },
    });

    return NextResponse.json({
      success: true,
      message: "Cari düzeltme kaydedildi.",
      data: { entry, affectedIds: [id], status: "recorded" },
    });
  } catch (error) {
    if (error instanceof SupplierFinanceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_ADJUSTMENT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Cari düzeltme kaydedilemedi." },
      { status: 500 }
    );
  }
}
