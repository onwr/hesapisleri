import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildSupplierLedgerExportCsv } from "@/lib/supplier-ledger-export-service";
import { parseSupplierListBalanceDirection } from "@/lib/supplier-utils";
import type { SupplierLedgerRowType } from "@/lib/supplier-ledger-utils";

function parseLedgerExportType(value: string | null): SupplierLedgerRowType | "all" {
  if (
    value === "OPENING_BALANCE" ||
    value === "EXPENSE" ||
    value === "PAYMENT" ||
    value === "COLLECTION" ||
    value === "ADJUSTMENT" ||
    value === "RETURN"
  ) {
    return value;
  }
  return "all";
}

function parseDateParam(value: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));
    const type = parseLedgerExportType(searchParams.get("type"));
    const accountId = searchParams.get("accountId")?.trim() || null;
    const supplierId = searchParams.get("supplierId")?.trim() || null;
    const balanceDirection = parseSupplierListBalanceDirection(
      searchParams.get("balanceDirection")
    );

    const csv = await buildSupplierLedgerExportCsv({
      companyId: auth.companyId,
      supplierId,
      from,
      to,
      type,
      accountId,
      balanceDirection:
        balanceDirection === "all" ? "all" : balanceDirection,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tedarikci-cari.csv"',
      },
    });
  } catch (error) {
    console.error("SUPPLIER_LEDGER_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Cari dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
