import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  getProductsExportRows,
  parseCategoryFilter,
  parseProductTab,
  parseSearchQuery,
} from "@/lib/products-page-data";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function getStatusLabel(status: string) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "SUSPENDED") return "Askıda";
  return "Pasif";
}

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const tab = parseProductTab(searchParams.get("tab"));
    const category = parseCategoryFilter(searchParams.get("category"));
    const q = parseSearchQuery(searchParams.get("q"));

    const products = await getProductsExportRows(payload.companyId, {
      tab,
      category,
      q,
    });

    const header = [
      "Ürün Adı",
      "Stok Kodu",
      "Barkod",
      "Grup",
      "Stok",
      "Satış Fiyatı",
      "Durum",
    ];

    const rows = products.map((product, index) => [
      product.name,
      product.sku || `STK-${String(index + 1).padStart(4, "0")}`,
      product.barcode ?? "",
      product.categoryName,
      String(product.stock),
      String(Number(product.sellPrice)),
      getStatusLabel(product.status),
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="urunler.csv"',
      },
    });
  } catch (error) {
    console.error("PRODUCT_EXPORT_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Ürün listesi dışa aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
