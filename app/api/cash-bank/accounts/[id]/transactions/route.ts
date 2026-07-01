import { NextResponse } from "next/server";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import {
  applyManualAccountTransaction,
  manualTransactionSchema,
} from "@/lib/cash-bank-account-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const originError = verifyApiMutationOrigin(req);
    if (originError) return originError;

    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { id } = await params;
    const body = await req.json();
    const parsed = manualTransactionSchema.safeParse({
      ...body,
      amount:
        body.amount !== undefined && body.amount !== null
          ? Number(body.amount)
          : body.amount,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await applyManualAccountTransaction({
      companyId,
      userId,
      accountId: id,
      data: parsed.data,
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
        entityIds: { accountId: id },
        entity: { newBalance: result.data.newBalance },
        message: "Hareket kaydedildi.",
        balances: { [id]: result.data.newBalance },
        extra: {
          negativeBalanceWarning: result.data.negativeBalanceWarning,
        },
      }),
    );
  } catch (error) {
    console.error("CASH_BANK_MANUAL_TRANSACTION_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Hareket kaydedilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
