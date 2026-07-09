import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import { cancelAccountTransfer } from "@/lib/cash-bank-account-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ transferGroupId: string }>;
};

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "İptal nedeni zorunludur."),
  idempotencyKey: z.string().uuid().optional(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const originError = verifyApiMutationOrigin(req);
    if (originError) return originError;

    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { transferGroupId } = await params;
    const body = await req.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "İptal nedeni zorunludur." },
        { status: 400 }
      );
    }

    const result = await cancelAccountTransfer({
      companyId,
      userId,
      transferGroupId,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "account-transfer",
        message: "Transfer iptal edildi.",
        entity: result.data,
      })
    );
  } catch (error) {
    console.error("CANCEL_ACCOUNT_TRANSFER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Transfer iptal edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
