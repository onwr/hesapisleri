import { NextResponse } from "next/server";
import { cancelInvoiceDocument } from "@/lib/efaturam/efaturam-document-service";
import { requireApiModuleAccess } from "@/lib/module-access";

type Props = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const result = await cancelInvoiceDocument({
      companyId: auth.companyId,
      invoiceId: id,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "E-Arşiv belgesi iptal edildi.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "E-Arşiv iptal edilemedi.",
      },
      { status: 400 }
    );
  }
}
