import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import { reverseInvoiceCollection } from "@/lib/invoice-collection-reversal-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ transactionId: string }>;
};

const reverseSchema = z.object({
  reason: z.string().trim().min(1, "İptal nedeni zorunludur."),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const originError = verifyApiMutationOrigin(req);
    if (originError) return originError;

    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const { transactionId } = await params;
    const body = await req.json();
    const parsed = reverseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "İptal nedeni zorunludur." },
        { status: 400 }
      );
    }

    const result = await reverseInvoiceCollection({
      companyId,
      userId,
      accountTransactionId: transactionId,
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
        reason: "invoice-collect",
        message: "Tahsilat ters kayıt ile iptal edildi.",
        entity: result.data,
      })
    );
  } catch (error) {
    console.error("REVERSE_INVOICE_COLLECTION_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Tahsilat iptal edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
