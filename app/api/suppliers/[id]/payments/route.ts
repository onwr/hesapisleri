import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireApiSupplierFinance,
} from "@/lib/module-access";
import {
  createSupplierPayment,
  SupplierFinanceError,
} from "@/lib/supplier-finance-service";
import { invalidateTenantCaches } from "@/lib/tenant-cache/tenant-cache-invalidation";

const bodySchema = z.object({
  accountId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().optional(),
  description: z.string().optional(),
  expenseId: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
});

type Props = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiSupplierFinance();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz ödeme verisi." },
        { status: 400 }
      );
    }

    const result = await createSupplierPayment({
      companyId: auth.companyId,
      supplierId: id,
      userId: auth.userId,
      accountId: parsed.data.accountId,
      amount: parsed.data.amount,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      description: parsed.data.description,
      expenseId: parsed.data.expenseId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    invalidateTenantCaches(auth.companyId, {
      reason: "supplier-payment",
      entityIds: { supplierId: id },
    });

    return NextResponse.json({
      success: true,
      message: result.replay ? "Ödeme zaten kayıtlı." : "Tedarikçi ödemesi kaydedildi.",
      data: {
        ...result,
        affectedIds: [id],
        status: result.replay ? "replay" : "recorded",
      },
      warning: result.overpaymentNotice,
    });
  } catch (error) {
    if (error instanceof SupplierFinanceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("SUPPLIER_PAYMENT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ödeme kaydedilemedi." },
      { status: 500 }
    );
  }
}
