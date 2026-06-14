import type { MarketplaceChannel } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getMarketplaceAdapter } from "@/lib/marketplace/marketplace-integration-service";
import type {
  MarketplaceAdapter,
  NormalizedMarketplaceListing,
} from "@/lib/marketplace/marketplace-types";
import {
  buildProductLookupMaps,
  classifyMappingAfterUniqueViolation,
  decideListingImport,
  isPrismaUniqueConstraintError,
  sanitizeMarketplaceErrorMessage,
  skipReasonLabel,
  type ProductMappingImportItem,
} from "@/lib/marketplace/marketplace-product-mapping-import-utils";

const marketplaceDb = db as typeof db & Record<string, any>;

export type ProductMappingImportResult = {
  success: true;
  channel: MarketplaceChannel;
  fetched: number;
  mapped: number;
  alreadyMapped: number;
  unmatched: number;
  skipped: number;
  conflicts: number;
  items: {
    mapped: ProductMappingImportItem[];
    unmatched: ProductMappingImportItem[];
    conflicts: ProductMappingImportItem[];
    skipped: ProductMappingImportItem[];
  };
  errors?: Array<{ message: string; page?: number }>;
};

export function adapterSupportsListingImport(
  adapter: MarketplaceAdapter
): adapter is MarketplaceAdapter & {
  fetchListings: NonNullable<MarketplaceAdapter["fetchListings"]>;
} {
  return typeof adapter.fetchListings === "function";
}

async function fetchAllListings(
  fetchListings: NonNullable<MarketplaceAdapter["fetchListings"]>
) {
  const listings: NormalizedMarketplaceListing[] = [];
  const errors: Array<{ message: string; page?: number }> = [];
  let cursor: string | null = "0";
  let guard = 0;

  while (cursor != null && guard < 25) {
    guard += 1;
    const page = await fetchListings({ cursor, limit: 100 });
    listings.push(...page.listings);
    if (page.errors?.length) {
      for (const error of page.errors) {
        errors.push({
          message: sanitizeMarketplaceErrorMessage(error.message),
          page: error.page,
        });
      }
    }
    if (!page.hasMore || !page.cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return { listings, errors };
}

async function persistProductChannelMapping(input: {
  companyId: string;
  channel: MarketplaceChannel;
  listing: NormalizedMarketplaceListing;
  productId: string;
  item: ProductMappingImportItem;
  existingMappingsByMerchantSku: Map<
    string,
    { productId: string; barcode: string | null }
  >;
}): Promise<
  | { outcome: "mapped"; item: ProductMappingImportItem }
  | { outcome: "already_mapped" }
  | { outcome: "conflict"; item: ProductMappingImportItem }
> {
  const merchantSku = input.listing.merchantSku.trim();
  const barcode = input.listing.barcode?.trim() || null;

  try {
    await marketplaceDb.productChannelMapping.create({
      data: {
        companyId: input.companyId,
        channel: input.channel,
        merchantSku,
        productId: input.productId,
        barcode,
        externalProductId: input.listing.externalListingId ?? null,
      },
    });
    input.existingMappingsByMerchantSku.set(merchantSku, {
      productId: input.productId,
      barcode,
    });
    return { outcome: "mapped", item: input.item };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await marketplaceDb.productChannelMapping.findUnique({
      where: {
        companyId_channel_merchantSku: {
          companyId: input.companyId,
          channel: input.channel,
          merchantSku,
        },
      },
      select: { productId: true, barcode: true },
    });

    const raceOutcome = classifyMappingAfterUniqueViolation({
      expectedProductId: input.productId,
      existingProductId: existing?.productId,
    });

    if (existing) {
      input.existingMappingsByMerchantSku.set(merchantSku, {
        productId: existing.productId,
        barcode: existing.barcode,
      });
    }

    if (raceOutcome === "already_mapped") {
      return { outcome: "already_mapped" };
    }

    return {
      outcome: "conflict",
      item: {
        ...input.item,
        reason:
          "Merchant SKU zaten farklı bir panel ürününe eşli (eşzamanlı import).",
      },
    };
  }
}

export async function importMarketplaceProductMappings(input: {
  companyId: string;
  channel: MarketplaceChannel;
}): Promise<ProductMappingImportResult> {
  const integration = await marketplaceDb.marketplaceIntegration.findUnique({
    where: {
      companyId_channel: { companyId: input.companyId, channel: input.channel },
    },
  });

  if (!integration?.credentialsEncrypted) {
    throw new Error("Entegrasyon kimlik bilgileri bulunamadı.");
  }
  if (integration.status !== "CONNECTED") {
    throw new Error("Ürün eşleme importu için entegrasyon bağlı olmalıdır.");
  }

  const adapter = await getMarketplaceAdapter({
    channel: integration.channel,
    credentialsEncrypted: integration.credentialsEncrypted,
  });

  if (!adapterSupportsListingImport(adapter)) {
    throw new Error("Bu kanal için ürün eşleme importu henüz desteklenmiyor.");
  }

  const { listings, errors } = await fetchAllListings(adapter.fetchListings.bind(adapter));

  const [products, existingMappings] = await Promise.all([
    marketplaceDb.product.findMany({
      where: { companyId: input.companyId },
      select: { id: true, name: true, sku: true, barcode: true },
    }),
    marketplaceDb.productChannelMapping.findMany({
      where: { companyId: input.companyId, channel: input.channel },
      select: { merchantSku: true, productId: true, barcode: true },
    }),
  ]);

  const { bySku, byBarcode } = buildProductLookupMaps(products);
  const existingMappingsByMerchantSku = new Map(
    existingMappings.map(
      (row: { merchantSku: string; productId: string; barcode: string | null }) => [
        row.merchantSku,
        { productId: row.productId, barcode: row.barcode },
      ]
    )
  );

  const seenMerchantSkus = new Set<string>();
  let mapped = 0;
  let alreadyMapped = 0;
  let unmatched = 0;
  let skipped = 0;
  let conflicts = 0;

  const mappedItems: ProductMappingImportItem[] = [];
  const unmatchedItems: ProductMappingImportItem[] = [];
  const conflictItems: ProductMappingImportItem[] = [];
  const skippedItems: ProductMappingImportItem[] = [];

  for (const listing of listings) {
    const decision = decideListingImport({
      listing,
      bySku,
      byBarcode,
      existingMappingsByMerchantSku,
      seenMerchantSkus,
    });

    switch (decision.action) {
      case "skip":
        skipped += 1;
        skippedItems.push({
          ...decision.item,
          reason: skipReasonLabel(decision.reason, decision.item.reason),
        });
        break;
      case "unmatched":
        unmatched += 1;
        unmatchedItems.push(decision.item);
        break;
      case "conflict":
        conflicts += 1;
        conflictItems.push(decision.item);
        break;
      case "already_mapped":
        alreadyMapped += 1;
        break;
      case "mapped": {
        const persistResult = await persistProductChannelMapping({
          companyId: input.companyId,
          channel: input.channel,
          listing,
          productId: decision.productId,
          item: decision.item,
          existingMappingsByMerchantSku,
        });

        if (persistResult.outcome === "mapped") {
          mapped += 1;
          mappedItems.push(persistResult.item);
        } else if (persistResult.outcome === "already_mapped") {
          alreadyMapped += 1;
        } else {
          conflicts += 1;
          conflictItems.push(persistResult.item);
        }
        break;
      }
    }
  }

  return {
    success: true,
    channel: input.channel,
    fetched: listings.length,
    mapped,
    alreadyMapped,
    unmatched,
    skipped,
    conflicts,
    items: {
      mapped: mappedItems.slice(0, 50),
      unmatched: unmatchedItems.slice(0, 50),
      conflicts: conflictItems.slice(0, 50),
      skipped: skippedItems.slice(0, 10),
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}
