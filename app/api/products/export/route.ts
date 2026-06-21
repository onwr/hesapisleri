import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getProductsExportRows,
  parseProductsListOptions,
} from "@/lib/products-page-data";
import { PRODUCT_TYPE_LABELS } from "@/lib/product-type-utils";
import { calculateProductStockValue } from "@/lib/inventory-value-utils";

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
    const auth = await requireApiModuleAccess("products");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const listOptions = parseProductsListOptions({
      tab: searchParams.get("tab"),
      category: searchParams.get("category"),
      q: searchParams.get("q"),
      stock: searchParams.get("stock"),
      sort: searchParams.get("sort"),
    });

    const products = await getProductsExportRows(companyId, listOptions);

    const header = [
      "Ürün Adı",
      "Tür",
      "Stok Kodu",
      "Barkod",
      "Grup",
      "Stok",
      "Alış Fiyatı",
      "Satış Fiyatı",
      "Stok Değeri",
      "Durum",
    ];

    const rows = products.map((product, index) => [
      product.name,
      PRODUCT_TYPE_LABELS[product.productType],
      product.sku || `STK-${String(index + 1).padStart(4, "0")}`,
      product.barcode ?? "",
      product.categoryName,
      product.isService ? "Stoksuz" : String(product.stock),
      String(Number(product.buyPrice)),
      String(Number(product.sellPrice)),
      product.isService
        ? ""
        : String(
            calculateProductStockValue({
              productType: product.productType,
              stock: product.stock,
              buyPrice: product.buyPrice,
            })
          ),
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
