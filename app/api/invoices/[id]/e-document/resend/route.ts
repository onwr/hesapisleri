import { NextResponse } from "next/server";
import { resendInvoiceDocument } from "@/lib/efaturam/efaturam-document-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await resendInvoiceDocument({
      companyId: auth.companyId,
      invoiceId: id,
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "invoice-e-document-action",
        entity: { id },
        message: "E-Fatura yeniden gönderildi.",
        entityIds: { invoiceId: id },
        extra: result,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "E-Fatura yeniden gönderilemedi.",
      },
      { status: 400 }
    );
  }
}
