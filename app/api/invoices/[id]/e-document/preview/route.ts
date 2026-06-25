import { NextResponse } from "next/server";
import { z } from "zod";
import { previewInvoiceEDocument } from "@/lib/e-document/e-document-preview-service";
import { requireApiModuleAccess } from "@/lib/module-access";

const schema = z.object({
  documentType: z.enum(["E_INVOICE", "E_ARCHIVE"]).optional(),
  targetAlias: z.string().trim().optional().nullable(),
  internetSale: z.boolean().optional(),
  invoiceTypeCode: z.enum(["SATIS", "IADE"]).optional(),
  commercialProfile: z.boolean().optional(),
  internetSaleOrderNumber: z.string().trim().optional(),
  internetSaleOrderDate: z.string().trim().optional(),
  internetSaleWebAddress: z.string().trim().optional(),
  internetSalePaymentMethod: z.string().trim().optional(),
  internetSalePaymentDate: z.string().trim().optional(),
  internetSalePaymentAgent: z.string().trim().optional(),
  internetSaleCarrier: z.string().trim().optional(),
  internetSaleShippingInfo: z.string().trim().optional(),
  internetSaleDeliveryInfo: z.string().trim().optional(),
});

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek." },
        { status: 400 }
      );
    }

    const result = await previewInvoiceEDocument({
      companyId: auth.companyId,
      invoiceId: id,
      preview: parsed.data,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.sendable
        ? "E-belge önizlemesi gönderime hazır görünüyor."
        : "E-belge önizlemesinde eksikler var.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "E-belge önizlemesi oluşturulamadı.",
      },
      { status: 400 }
    );
  }
}
