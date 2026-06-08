import { db } from "@/lib/prisma";
import {
  endOfLastMonth,
  endOfMonth,
  startOfLastMonth,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import {
  formatProductMoney,
  formatProductNumber,
  isServiceProduct,
  type ProductStatCard,
  type ProductTabKey,
  type ProductTableRow,
} from "@/lib/products-page-utils";

export type { ProductStatCard, ProductTabKey, ProductTableRow } from "@/lib/products-page-utils";
export {
  buildProductsExportQuery,
  buildProductsQuery,
  formatProductMoney,
  formatProductNumber,
  getCategoryBadge,
  getProductStatusBadge,
  getStockLevelStyle,
  isServiceProduct,
  parseCategoryFilter,
  parsePage,
  parseProductTab,
  parseSearchQuery,
  PRODUCT_TAB_LABELS,
} from "@/lib/products-page-utils";

const PAGE_SIZE = 10;

type ProductRecord = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  stock: number;
  minStock: number;
  sellPrice: unknown;
  status: string;
  createdAt: Date;
  category: { name: string } | null;
};

function matchesSearch(product: ProductRecord, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");
  const categoryName = product.category?.name ?? "";

  return (
    product.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (product.sku?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (product.barcode?.includes(query) ?? false) ||
    (product.description?.toLocaleLowerCase("tr-TR").includes(normalized) ??
      false) ||
    categoryName.toLocaleLowerCase("tr-TR").includes(normalized)
  );
}

function withMeta(product: ProductRecord) {
  const categoryName = product.category?.name || "Genel";

  return {
    ...product,
    categoryName,
    isService: isServiceProduct({
      name: product.name,
      description: product.description,
      categoryName,
    }),
  };
}

function filterByTab(
  products: ReturnType<typeof withMeta>[],
  tab: ProductTabKey
) {
  switch (tab) {
    case "active":
      return products.filter((product) => product.status === "ACTIVE");
    case "passive":
      return products.filter((product) => product.status !== "ACTIVE");
    case "service":
      return products.filter((product) => product.isService);
    case "product":
      return products.filter((product) => !product.isService);
    case "lowStock":
      return products.filter(
        (product) => !product.isService && product.stock <= product.minStock
      );
    default:
      return products;
  }
}

function toTableRow(product: ReturnType<typeof withMeta>, index: number): ProductTableRow {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku || `STK-${String(index + 1).padStart(4, "0")}`,
    barcode: product.barcode,
    categoryName: product.categoryName,
    stock: product.stock,
    sellPrice: Number(product.sellPrice),
    status: product.status,
    imageUrl: product.imageUrl,
    isService: product.isService,
  };
}

export async function getProductsPageData(
  companyId: string,
  options: {
    tab: ProductTabKey;
    page: number;
    category?: string | null;
    q?: string | null;
  }
) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

  const products = await db.product.findMany({
    where: { companyId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const enrichedProducts = products.map(withMeta);

  const categories = Array.from(
    new Set(
      enrichedProducts.map((product) => product.categoryName).filter(Boolean)
    )
  )
    .filter((name) => name !== "Genel")
    .sort((a, b) => a.localeCompare(b, "tr-TR"));

  const activeProducts = enrichedProducts.filter(
    (product) => product.status === "ACTIVE"
  );
  const passiveProducts = enrichedProducts.filter(
    (product) => product.status !== "ACTIVE"
  );
  const lowStockProducts = enrichedProducts.filter(
    (product) => !product.isService && product.stock <= product.minStock
  );

  const totalStock = enrichedProducts.reduce(
    (sum, product) => sum + product.stock,
    0
  );

  const totalStockValue = enrichedProducts.reduce(
    (sum, product) => sum + product.stock * Number(product.sellPrice),
    0
  );

  const addedThisMonth = enrichedProducts.filter(
    (product) =>
      product.createdAt >= monthStart && product.createdAt <= monthEnd
  ).length;

  const addedLastMonth = enrichedProducts.filter(
    (product) =>
      product.createdAt >= lastMonthStart && product.createdAt <= lastMonthEnd
  ).length;

  const statCards: ProductStatCard[] = [
    {
      title: "Toplam Ürün",
      value: formatProductNumber(enrichedProducts.length),
      subtitle: `Aktif: ${activeProducts.length}`,
      secondSubtitle: `Pasif: ${passiveProducts.length}`,
      iconKey: "package",
      color: "emerald",
    },
    {
      title: "Toplam Stok",
      value: formatProductNumber(totalStock),
      subtitle: "Tüm depolardaki toplam stok",
      iconKey: "boxes",
      color: "blue",
    },
    {
      title: "Düşük Stoklu Ürün",
      value: formatProductNumber(lowStockProducts.length),
      subtitle: "Stok limiti altındaki ürünler",
      iconKey: "alert",
      color: "orange",
    },
    {
      title: "Stok Değeri",
      value: formatProductMoney(totalStockValue),
      subtitle: "Tahmini toplam stok değeri",
      iconKey: "wallet",
      color: "emerald",
    },
    {
      title: "Bu Ay Eklenen",
      value: formatProductNumber(addedThisMonth),
      subtitle: `Geçen ay: ${addedLastMonth}`,
      iconKey: "spreadsheet",
      color: "violet",
    },
  ];

  let filteredProducts = filterByTab(enrichedProducts, options.tab);

  if (options.category) {
    filteredProducts = filteredProducts.filter(
      (product) => product.categoryName === options.category
    );
  }

  if (options.q) {
    filteredProducts = filteredProducts.filter((product) =>
      matchesSearch(product, options.q!)
    );
  }

  const totalRecords = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const rows = filteredProducts
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map((product, index) => toTableRow(product, startIndex + index));

  return {
    statCards,
    rows,
    categories,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
  };
}

export async function getProductsExportRows(
  companyId: string,
  options: {
    tab: ProductTabKey;
    category?: string | null;
    q?: string | null;
  }
) {
  const products = await db.product.findMany({
    where: { companyId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const enrichedProducts = products.map(withMeta);
  let filteredProducts = filterByTab(enrichedProducts, options.tab);

  if (options.category) {
    filteredProducts = filteredProducts.filter(
      (product) => product.categoryName === options.category
    );
  }

  if (options.q) {
    filteredProducts = filteredProducts.filter((product) =>
      matchesSearch(product, options.q!)
    );
  }

  return filteredProducts;
}
