import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  buildCsvContent,
  buildCustomerDetailCsvRow,
  CUSTOMER_DETAIL_CSV_HEADER,
  sanitizeCustomerExportFilename,
} from "@/lib/customer-export-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Müşteri bulunamadı." },
        { status: 404 }
      );
    }

    const csv = buildCsvContent(CUSTOMER_DETAIL_CSV_HEADER, [
      buildCustomerDetailCsvRow(customer),
    ]);

    const filename = `${sanitizeCustomerExportFilename(customer.name)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CUSTOMER_SINGLE_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Müşteri dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
