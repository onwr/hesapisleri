import { NextResponse } from "next/server";
import {
  buildAccountTransactionsCsv,
  sanitizeAccountExportFilename,
} from "@/lib/cash-bank-account-utils";
import { getAccountExportData } from "@/lib/cash-bank-account-service";
import { requireApiModuleAccess } from "@/lib/module-access";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: Props) {
  try {
    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { companyId } = auth;
    const { id } = await params;
    const exportData = await getAccountExportData(companyId, id);

    if (!exportData) {
      return NextResponse.json(
        { success: false, message: "Hesap bulunamadı." },
        { status: 404 }
      );
    }

    const csv = buildAccountTransactionsCsv(exportData.transactions);
    const filename = `${sanitizeAccountExportFilename(exportData.accountName)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CASH_BANK_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Hesap hareketleri dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
