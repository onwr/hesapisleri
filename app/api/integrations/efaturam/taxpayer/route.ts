import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import { lookupTaxpayer } from "@/lib/efaturam/efaturam-auth-service";
import {
  normalizeTaxIdInput,
  parseTaxpayerLookupResponse,
} from "@/lib/efaturam/efaturam-taxpayer-utils";

const schema = z.object({
  taxId: z.string().trim().min(10).max(11),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("invoices");
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz VKN/TCKN." },
        { status: 400 }
      );
    }

    const taxId = normalizeTaxIdInput(parsed.data.taxId);
    const raw = await lookupTaxpayer({
      companyId: auth.companyId,
      taxId,
    });
    const data = parseTaxpayerLookupResponse(taxId, raw);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Mükellef sorgusu başarısız.",
      },
      { status: 400 }
    );
  }
}
