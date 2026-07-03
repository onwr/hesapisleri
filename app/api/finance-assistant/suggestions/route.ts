import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { buildFinanceCategorySuggestions } from "@/lib/finance-assistant/category-suggestions";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category")?.trim() || "Satış";
    const suggestions = await buildFinanceCategorySuggestions(
      auth.companyId,
      category
    );

    return NextResponse.json({ success: true, data: { suggestions } });
  } catch (error) {
    console.error("[finance-assistant/suggestions]", error);
    return NextResponse.json(
      { success: true, data: { suggestions: ["Öneriler şu anda yüklenemedi."] } }
    );
  }
}
