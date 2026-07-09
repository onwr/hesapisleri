import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import {
  deleteManualAccountTransaction,
  reverseManualAccountTransaction,
} from "@/lib/cash-bank-transaction-mutation-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

const reverseSchema = z.object({
  action: z.literal("reverse"),
  reason: z.string().trim().min(1, "İptal nedeni zorunludur."),
});

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const originError = verifyApiMutationOrigin(_req);
    if (originError) return originError;

    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;

    const result = await deleteManualAccountTransaction({
      companyId,
      userId,
      transactionId: id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "cash-bank-manual-transaction",
        entity: { transactionId: id },
        message: "Hareket silindi.",
      })
    );
  } catch (error) {
    console.error("DELETE_CASH_BANK_TRANSACTION_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hareket silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Props) {
  try {
    const originError = verifyApiMutationOrigin(req);
    if (originError) return originError;

    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;
    const body = await req.json();
    const parsed = reverseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz işlem." },
        { status: 400 }
      );
    }

    const result = await reverseManualAccountTransaction({
      companyId,
      userId,
      transactionId: id,
      reason: parsed.data.reason,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "cash-bank-manual-transaction",
        message: "Hareket ters kayıt ile iptal edildi.",
        entity: result.data,
      })
    );
  } catch (error) {
    console.error("REVERSE_CASH_BANK_TRANSACTION_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ters kayıt oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
