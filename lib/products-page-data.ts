import type { MarketplaceChannel } from "@prisma/client";
import { db } from "@/lib/prisma";
import { calculateInventoryValue } from "@/lib/inventory-value-utils";
import {
  matchesProductStockFilter,
  parseProductSort,
  parseProductStockFilter,
  sortProducts,
  type ProductSortKey,
  type ProductStockFilterKey,
} from "@/lib/product-ui-utils";
import {
  formatProductMoney,
  formatProductNumber,
  isServiceProduct,
  parseCategoryFilter,
  parsePage,
  parseProductTab,
  parseSearchQuery,
  type ProductTabKey,
  type ProductTableRow,
} from "@/lib/products-page-utils";

export type { ProductTabKey, ProductTableRow } from "@/lib/products-page-utils";
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

export type ProductPageStats = {
  totalProducts: number;
  stockProducts: number;
  serviceProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  lowOrNegativeStock: number;
  totalStockValue: number;
};

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
  productType: "STOCK" | "SERVICE";
  buyPrice: unknown;
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
    buyPrice: Number(product.buyPrice),
    sellPrice: Number(product.sellPrice),
    isService: product.productType === "SERVICE",
    productType: product.productType,
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

function toTableRow(
  product: ReturnType<typeof withMeta>,
  index: number,
  channelMap: Map<string, MarketplaceChannel[]>
): ProductTableRow {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku || `STK-${String(index + 1).padStart(4, "0")}`,
    barcode: product.barcode,
    categoryName: product.categoryName,
    stock: product.stock,
    minStock: product.minStock,
    buyPrice: product.buyPrice,
    sellPrice: product.sellPrice,
    status: product.status,
    imageUrl: product.imageUrl,
    isService: product.isService,
    productType: product.productType,
    mappedChannels: channelMap.get(product.id) ?? [],
  };
}

export async function getProductsPageData(
  companyId: string,
  options: {
    tab: ProductTabKey;
    page: number;
    category?: string | null;
    q?: string | null;
    stock?: ProductStockFilterKey;
    sort?: ProductSortKey;
  }
) {
  const [products, channelMappings] = await Promise.all([
    db.product.findMany({
      where: { companyId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    db.productChannelMapping.findMany({
      where: { companyId },
      select: { productId: true, channel: true },
    }),
  ]);

  const channelMap = new Map<string, MarketplaceChannel[]>();

  for (const mapping of channelMappings) {
    const current = channelMap.get(mapping.productId) ?? [];
    if (!current.includes(mapping.channel)) {
      current.push(mapping.channel);
    }
    channelMap.set(mapping.productId, current);
  }

  const enrichedProducts = products.map(withMeta);

  const categories = Array.from(
    new Set(
      enrichedProducts.map((product) => product.categoryName).filter(Boolean)
    )
  )
    .filter((name) => name !== "Genel")
    .sort((a, b) => a.localeCompare(b, "tr-TR"));

  const stockProducts = enrichedProducts.filter((product) => !product.isService);
  const serviceProducts = enrichedProducts.filter((product) => product.isService);
  const activeProducts = enrichedProducts.filter(
    (product) => product.status === "ACTIVE"
  );
  const lowStockProducts = stockProducts.filter(
    (product) => product.stock > 0 && product.stock <= product.minStock
  );
  const outOfStockProducts = stockProducts.filter(
    (product) => product.stock <= 0
  );

  const totalStockValue = calculateInventoryValue(enrichedProducts);

  const stats: ProductPageStats = {
    totalProducts: enrichedProducts.length,
    stockProducts: stockProducts.length,
    serviceProducts: serviceProducts.length,
    activeProducts: activeProducts.length,
    lowStockProducts: lowStockProducts.length,
    outOfStockProducts: outOfStockProducts.length,
    lowOrNegativeStock:
      lowStockProducts.length + outOfStockProducts.length,
    totalStockValue,
  };

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

  if (options.stock && options.stock !== "all") {
    filteredProducts = filteredProducts.filter((product) =>
      matchesProductStockFilter(product, options.stock!)
    );
  }

  filteredProducts = sortProducts(filteredProducts, options.sort ?? "recent");

  const totalRecords = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const rows = filteredProducts
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map((product, index) => toTableRow(product, startIndex + index, channelMap));

  return {
    stats,
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
    stock?: ProductStockFilterKey;
    sort?: ProductSortKey;
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

  if (options.stock && options.stock !== "all") {
    filteredProducts = filteredProducts.filter((product) =>
      matchesProductStockFilter(product, options.stock!)
    );
  }

  return sortProducts(filteredProducts, options.sort ?? "recent");
}

export function parseProductsListOptions(params: {
  tab?: string | null;
  page?: string | null;
  category?: string | null;
  q?: string | null;
  stock?: string | null;
  sort?: string | null;
}) {
  return {
    tab: parseProductTab(params.tab),
    page: parsePage(params.page),
    category: parseCategoryFilter(params.category),
    q: parseSearchQuery(params.q),
    stock: parseProductStockFilter(params.stock),
    sort: parseProductSort(params.sort),
  };
}
