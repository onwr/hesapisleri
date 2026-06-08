import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  collectInvoicePayment,
  collectInvoiceSchema,
} from "@/lib/invoice-service";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = collectInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(errors).flat()[0];

      return NextResponse.json(
        {
          success: false,
          message: firstError || "Geçersiz istek.",
          errors,
        },
        { status: 400 }
      );
    }

    const { id } = await params;

    const result = await collectInvoicePayment({
      companyId,
      userId,
      invoiceId: id,
      data: parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        result.data.paymentStatus === "PAID"
          ? "Fatura tahsilatı tamamlandı."
          : "Kısmi tahsilat kaydedildi.",
      data: result.data,
    });
  } catch (error) {
    console.error("INVOICE_COLLECT_API_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Tahsilat kaydedilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
