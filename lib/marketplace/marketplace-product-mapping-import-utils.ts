import type { NormalizedMarketplaceListing } from "@/lib/marketplace/marketplace-types";

export type ProductMappingImportItem = {
  merchantSku: string;
  barcode?: string | null;
  title?: string | null;
  productId?: string | null;
  productName?: string | null;
  reason?: string;
};

export type ListingImportDecision =
  | {
      action: "skip";
      reason: "missing_merchant_sku" | "duplicate_listing";
      item: ProductMappingImportItem;
    }
  | {
      action: "unmatched";
      item: ProductMappingImportItem;
    }
  | {
      action: "conflict";
      item: ProductMappingImportItem;
      reason: string;
    }
  | {
      action: "already_mapped";
      item: ProductMappingImportItem;
      productId: string;
    }
  | {
      action: "mapped";
      item: ProductMappingImportItem;
      productId: string;
    };

export type ProductLookupRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
};

export function buildProductLookupMaps(products: ProductLookupRow[]) {
  const bySku = new Map<string, ProductLookupRow>();
  const byBarcode = new Map<string, ProductLookupRow>();

  for (const product of products) {
    const sku = product.sku?.trim();
    if (sku && !bySku.has(sku)) {
      bySku.set(sku, product);
    }
    const barcode = product.barcode?.trim();
    if (barcode && !byBarcode.has(barcode)) {
      byBarcode.set(barcode, product);
    }
  }

  return { bySku, byBarcode };
}

export function resolveListingProductMatch(input: {
  listing: Pick<NormalizedMarketplaceListing, "merchantSku" | "barcode">;
  bySku: Map<string, ProductLookupRow>;
  byBarcode: Map<string, ProductLookupRow>;
}): { product: ProductLookupRow | null; conflictReason?: string } {
  const merchantSku = input.listing.merchantSku.trim();
  const barcode = input.listing.barcode?.trim() || null;

  const productBySku = merchantSku ? input.bySku.get(merchantSku) ?? null : null;
  const productByBarcode = barcode ? input.byBarcode.get(barcode) ?? null : null;

  if (productBySku && productByBarcode && productBySku.id !== productByBarcode.id) {
    return {
      product: null,
      conflictReason:
        "Merchant SKU ve barkod farklı panel ürünlerine işaret ediyor.",
    };
  }

  return { product: productBySku ?? productByBarcode ?? null };
}

export function decideListingImport(input: {
  listing: NormalizedMarketplaceListing;
  bySku: Map<string, ProductLookupRow>;
  byBarcode: Map<string, ProductLookupRow>;
  existingMappingsByMerchantSku: Map<
    string,
    { productId: string; barcode: string | null }
  >;
  seenMerchantSkus: Set<string>;
}): ListingImportDecision {
  const merchantSku = input.listing.merchantSku.trim();
  const baseItem: ProductMappingImportItem = {
    merchantSku,
    barcode: input.listing.barcode ?? null,
    title: input.listing.title ?? null,
  };

  if (!merchantSku) {
    return {
      action: "skip",
      reason: "missing_merchant_sku",
      item: baseItem,
    };
  }

  if (input.seenMerchantSkus.has(merchantSku)) {
    return {
      action: "skip",
      reason: "duplicate_listing",
      item: { ...baseItem, reason: "Aynı merchant SKU tekrarlandı." },
    };
  }
  input.seenMerchantSkus.add(merchantSku);

  const { product, conflictReason } = resolveListingProductMatch({
    listing: input.listing,
    bySku: input.bySku,
    byBarcode: input.byBarcode,
  });

  if (conflictReason) {
    return {
      action: "conflict",
      reason: conflictReason,
      item: { ...baseItem, reason: conflictReason },
    };
  }

  const existing = input.existingMappingsByMerchantSku.get(merchantSku);
  if (!product) {
    return {
      action: "unmatched",
      item: baseItem,
    };
  }

  const enrichedItem: ProductMappingImportItem = {
    ...baseItem,
    productId: product.id,
    productName: product.name,
  };

  if (existing) {
    if (existing.productId === product.id) {
      return {
        action: "already_mapped",
        productId: product.id,
        item: enrichedItem,
      };
    }
    return {
      action: "conflict",
      reason: "Merchant SKU zaten farklı bir panel ürününe eşli.",
      item: {
        ...enrichedItem,
        reason: "Merchant SKU zaten farklı bir panel ürününe eşli.",
      },
    };
  }

  return {
    action: "mapped",
    productId: product.id,
    item: enrichedItem,
  };
}

export function sanitizeMarketplaceErrorMessage(message: string) {
  return message
    .replace(/api[_-]?key[=:\s][^\s,]+/gi, "apiKey=[REDACTED]")
    .replace(/api[_-]?secret[=:\s][^\s,]+/gi, "apiSecret=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9+/=._-]+/gi, "Bearer [REDACTED]");
}

export type MappingPersistOutcome = "mapped" | "already_mapped" | "conflict";

export function skipReasonLabel(
  reason: "missing_merchant_sku" | "duplicate_listing",
  itemReason?: string
) {
  if (reason === "missing_merchant_sku") {
    return "Merchant SKU yok.";
  }
  return itemReason ?? "Aynı merchant SKU tekrarlandı.";
}

export function classifyMappingAfterUniqueViolation(input: {
  expectedProductId: string;
  existingProductId: string | null | undefined;
}): MappingPersistOutcome {
  if (!input.existingProductId) {
    return "mapped";
  }
  return input.expectedProductId === input.existingProductId
    ? "already_mapped"
    : "conflict";
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export function isProductMappingImportEmptyResult(input: {
  fetched: number;
  mapped: number;
  alreadyMapped: number;
  unmatched: number;
  skipped: number;
  conflicts: number;
}) {
  return (
    input.fetched === 0 &&
    input.mapped === 0 &&
    input.alreadyMapped === 0 &&
    input.unmatched === 0 &&
    input.skipped === 0 &&
    input.conflicts === 0
  );
}
