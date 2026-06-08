import { NextResponse } from "next/server";
import { getExpenseFormAccounts } from "@/lib/expense-service";
import { requireAnyApiModuleAccess } from "@/lib/module-access";

export async function GET() {
  try {
    const auth = await requireAnyApiModuleAccess([
      "cash-bank",
      "pos",
      "expenses",
      "settings",
    ]);
    if ("error" in auth) return auth.error;

    const { companyId } = auth;

    const accounts = await getExpenseFormAccounts(companyId);

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    console.error("ACCOUNTS_LIST_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Hesaplar listelenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
