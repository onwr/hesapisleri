import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  importOrdersFromRows,
  orderImportRowSchema,
  parseOrderImportCsv,
} from "@/lib/order-import-service";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

const importSchema = z.object({
  rows: z.array(orderImportRowSchema).min(1),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("orders");
    if ("error" in auth) return auth.error;

    const body = await req.json();

    if (typeof body.csv === "string") {
      const parsedCsv = parseOrderImportCsv(body.csv);
      if (!parsedCsv.ok) {
        return NextResponse.json(
          { success: false, message: parsedCsv.message, errors: parsedCsv.errors },
          { status: 400 }
        );
      }

      const result = await importOrdersFromRows({
        companyId: auth.companyId,
        userId: auth.userId,
        rows: parsedCsv.rows,
      });

      return NextResponse.json(
        buildTenantMutationSuccess(auth.companyId, {
          reason: "order-import",
          entity: result as Record<string, unknown>,
          message: `${result.createdCount} sipariş içe aktarıldı.`,
        }),
      );
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz içe aktarım verisi." },
        { status: 400 }
      );
    }

    const result = await importOrdersFromRows({
      companyId: auth.companyId,
      userId: auth.userId,
      rows: parsed.data.rows,
    });

    return NextResponse.json(
      buildTenantMutationSuccess(auth.companyId, {
        reason: "order-import",
        entity: result as Record<string, unknown>,
        message: `${result.createdCount} sipariş içe aktarıldı.`,
      }),
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "İçe aktarım başarısız." },
      { status: 500 }
    );
  }
}
