import { NextResponse } from "next/server";
import { z } from "zod";
import { EntitlementError } from "@/lib/billing/entitlements/entitlement-errors";
import { submitInvoiceDocument } from "@/lib/efaturam/efaturam-document-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const schema = z.object({
  documentType: z.enum(["E_INVOICE", "E_ARCHIVE"]),
  targetAlias: z.string().trim().optional().nullable(),
  internetSale: z.boolean().optional(),
});

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek." },
        { status: 400 }
      );
    }

    const result = await submitInvoiceDocument({
      companyId: auth.companyId,
      invoiceId: id,
      documentType: parsed.data.documentType,
      targetAlias: parsed.data.targetAlias,
      internetSale: parsed.data.internetSale,
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "invoice-e-document-action",
        entity: { id },
        message: "E-belge gönderildi.",
        entityIds: { invoiceId: id },
        extra: {
          submission: result.submission,
          provider: {
            invoiceUuid: result.response.invoiceUuid ?? null,
            invoiceId: result.response.invoiceId ?? null,
            status: result.response.status ?? null,
            gibStatus: result.response.gibStatus ?? null,
          },
        },
      }),
    );
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "E-belge gönderilemedi.",
      },
      { status: 400 }
    );
  }
}
