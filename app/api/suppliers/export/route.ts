import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getSuppliers } from "@/lib/supplier-service";
import { db } from "@/lib/prisma";
import {
  buildSupplierCsvRow,
  buildSuppliersCsv,
} from "@/lib/supplier-utils";
import { parseSuppliersPageOptions } from "@/lib/supplier-page-data";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("suppliers");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const options = parseSuppliersPageOptions({
      tab: searchParams.get("tab") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      favorite: searchParams.get("favorite") ?? undefined,
    });

    let rows = await getSuppliers({
      companyId: auth.companyId,
      search: options.q,
      category: options.category,
      isFavorite: options.favorite || null,
    });

    if (options.tab === "active") {
      rows = rows.filter((row) => row.isActive);
    } else if (options.tab === "passive") {
      rows = rows.filter((row) => !row.isActive);
    } else if (options.tab === "payable") {
      rows = rows.filter((row) => row.currentBalance > 0);
    } else if (options.tab === "overdue") {
      rows = rows.filter((row) => row.overdueAmount > 0);
    }

    const suppliers = await db.supplier.findMany({
      where: { companyId: auth.companyId, id: { in: rows.map((row) => row.id) } },
      select: {
        id: true,
        code: true,
        name: true,
        companyName: true,
        contactName: true,
        phone: true,
        mobilePhone: true,
        email: true,
        taxNumber: true,
        category: true,
        currentBalance: true,
        city: true,
        district: true,
        address: true,
        tags: true,
        notes: true,
        isActive: true,
        currency: true,
        updatedAt: true,
      },
    });

    const supplierMap = new Map(suppliers.map((item) => [item.id, item]));
    const csvRows = rows.map((row) => {
      const supplier = supplierMap.get(row.id);
      return buildSupplierCsvRow({
        ...row,
        notes: supplier?.notes ?? null,
        tags: supplier?.tags ?? [],
        address: supplier?.address ?? null,
      });
    });

    const csv = buildSuppliersCsv(csvRows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tedarikciler.csv"',
      },
    });
  } catch (error) {
    console.error("SUPPLIERS_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Dışa aktarma başarısız." },
      { status: 500 }
    );
  }
}
