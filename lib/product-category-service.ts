import { calculateProductStockValue } from "@/lib/inventory-value-utils";
import { db } from "@/lib/prisma";
import { DEFAULT_CATEGORY_NAME } from "@/lib/product-form-utils";
import {
  DEFAULT_PRODUCT_CATEGORIES,
  getDefaultProductCategoryColor,
  normalizeProductCategoryName,
} from "@/lib/product-category-utils";
import { isServiceProduct } from "@/lib/products-page-utils";

type ProductForStats = {
  categoryId: string | null;
  productType?: "STOCK" | "SERVICE" | null;
  name: string;
  description: string | null;
  stock: number;
  minStock: number;
  buyPrice?: unknown;
  sellPrice: unknown;
  status: string;
};

function isStatsServiceProduct(product: ProductForStats, categoryName: string) {
  return isServiceProduct({
    productType: product.productType,
    name: product.name,
    description: product.description,
    categoryName,
  });
}

type ProductCategoryRecord = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  status: string;
  sortOrder: number;
};

export type ProductCategoryStats = {
  productCount: number;
  totalStock: number;
  stockValue: number;
  lowStockCount: number;
};

export type ProductCategoryWithStats = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  status: string;
  sortOrder: number;
  productCount: number;
  totalStock: number;
  stockValue: number;
  lowStockCount: number;
};

export type ProductCategoriesPageSummary = {
  totalCategories: number;
  activeCategories: number;
  totalProducts: number;
  lowStockProducts: number;
  uncategorizedProducts: number;
};

export function computeCategoryStats(
  products: ProductForStats[],
  categoryId: string,
  categoryName: string
): ProductCategoryStats {
  const members = products.filter((product) => product.categoryId === categoryId);

  let totalStock = 0;
  let stockValue = 0;
  let lowStockCount = 0;

  for (const product of members) {
    totalStock += product.stock;
    stockValue += calculateProductStockValue(product);

    const service = isStatsServiceProduct(product, categoryName);

    if (!service && product.stock <= product.minStock) {
      lowStockCount += 1;
    }
  }

  return {
    productCount: members.length,
    totalStock,
    stockValue,
    lowStockCount,
  };
}

export function summarizeProductCategoriesPage(
  categories: ProductCategoryRecord[],
  products: ProductForStats[]
): ProductCategoriesPageSummary {
  let lowStockProducts = 0;
  let uncategorizedProducts = 0;

  for (const product of products) {
    if (!product.categoryId) {
      uncategorizedProducts += 1;
    }

    const categoryName =
      categories.find((category) => category.id === product.categoryId)?.name ??
      DEFAULT_CATEGORY_NAME;

    const service = isStatsServiceProduct(product, categoryName);

    if (!service && product.stock <= product.minStock) {
      lowStockProducts += 1;
    }
  }

  return {
    totalCategories: categories.length,
    activeCategories: categories.filter((category) => category.status === "ACTIVE")
      .length,
    totalProducts: products.length,
    lowStockProducts,
    uncategorizedProducts,
  };
}

export async function ensureDefaultProductCategories(companyId: string) {
  for (const category of DEFAULT_PRODUCT_CATEGORIES) {
    const existing = await db.productCategory.findFirst({
      where: {
        companyId,
        name: category.name,
      },
    });

    if (!existing) {
      await db.productCategory.create({
        data: {
          companyId,
          name: category.name,
          color: category.color,
          sortOrder: category.sortOrder,
          status: "ACTIVE",
        },
      });
    }
  }
}

export async function prepareProductCategories(companyId: string) {
  await ensureDefaultProductCategories(companyId);
}

export async function getProductCategoriesWithStats(companyId: string) {
  await prepareProductCategories(companyId);

  const [categories, products] = await Promise.all([
    db.productCategory.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.product.findMany({
      where: { companyId },
      select: {
        categoryId: true,
        name: true,
        description: true,
        stock: true,
        minStock: true,
        buyPrice: true,
        productType: true,
        sellPrice: true,
        status: true,
      },
    }),
  ]);

  return {
    categories: categories.map((category: ProductCategoryRecord) => {
      const stats = computeCategoryStats(products, category.id, category.name);

      return {
        id: category.id,
        name: category.name,
        color: category.color,
        note: category.note,
        status: category.status,
        sortOrder: category.sortOrder,
        ...stats,
      } satisfies ProductCategoryWithStats;
    }),
    products,
    summary: summarizeProductCategoriesPage(categories, products),
  };
}

export async function getActiveProductCategoryNames(companyId: string) {
  const { categories } = await getProductCategoriesWithStats(companyId);

  return categories
    .filter((category) => category.status === "ACTIVE")
    .map((category) => category.name)
    .sort((a, b) => {
      if (a === DEFAULT_CATEGORY_NAME) return -1;
      if (b === DEFAULT_CATEGORY_NAME) return 1;
      return a.localeCompare(b, "tr-TR");
    });
}

export async function createProductCategory(
  companyId: string,
  input: { name: string; color?: string; note?: string }
) {
  const name = normalizeProductCategoryName(input.name);

  const existing = await db.productCategory.findFirst({
    where: {
      companyId,
      name,
    },
  });

  if (existing) {
    throw new Error("Bu isimde bir kategori zaten var.");
  }

  const maxSortOrder = await db.productCategory.aggregate({
    where: { companyId },
    _max: { sortOrder: true },
  });

  return db.productCategory.create({
    data: {
      companyId,
      name,
      color: input.color || getDefaultProductCategoryColor(name),
      note: input.note?.trim() || null,
      sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
      status: "ACTIVE",
    },
  });
}

export async function updateProductCategory(
  companyId: string,
  categoryId: string,
  input: {
    name?: string;
    color?: string;
    note?: string | null;
    status?: "ACTIVE" | "PASSIVE";
  }
) {
  const category = await db.productCategory.findFirst({
    where: {
      id: categoryId,
      companyId,
    },
  });

  if (!category) {
    throw new Error("Kategori bulunamadı.");
  }

  const nextName = input.name?.trim();
  const nextColor = input.color?.trim();
  const nextNote =
    input.note === undefined ? undefined : input.note?.trim() || null;

  if (nextName && nextName !== category.name) {
    const duplicate = await db.productCategory.findFirst({
      where: {
        companyId,
        name: nextName,
        NOT: { id: category.id },
      },
    });

    if (duplicate) {
      throw new Error("Bu isimde bir kategori zaten var.");
    }
  }

  if (
    category.name === DEFAULT_CATEGORY_NAME &&
    input.status === "PASSIVE"
  ) {
    throw new Error("Genel kategorisi pasife alınamaz.");
  }

  return db.productCategory.update({
    where: { id: category.id },
    data: {
      ...(nextName ? { name: nextName } : {}),
      ...(nextColor ? { color: nextColor } : {}),
      ...(nextNote !== undefined ? { note: nextNote } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });
}

export async function deleteProductCategory(companyId: string, categoryId: string) {
  const category = await db.productCategory.findFirst({
    where: {
      id: categoryId,
      companyId,
    },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  if (!category) {
    throw new Error("Kategori bulunamadı.");
  }

  if (category.name === DEFAULT_CATEGORY_NAME) {
    throw new Error("Genel kategorisi silinemez.");
  }

  if (category._count.products > 0) {
    throw new Error(
      "Bu kategoride ürün var, önce ürünleri başka kategoriye taşıyın."
    );
  }

  await db.productCategory.delete({
    where: { id: category.id },
  });
}
