import { db } from "@/lib/prisma";
import { canAccessModule } from "@/lib/permission-utils";
import { allowsNegativeStock } from "@/lib/stock-policy";
import { isServiceProductType } from "@/lib/product-type-utils";
import { getPosCollectionAccountOptions } from "@/lib/pos-collection-account-service";
import {
  type PosCheckoutInput,
} from "@/lib/pos-checkout-utils";
import { serializePosBootstrapSettingsForMobile, getPosBootstrapSettings } from "@/lib/pos-bootstrap-settings";
import { executePosCheckout } from "@/lib/pos-checkout-service";
import { getWarehouseOptions, getWarehouseStockByProductIds } from "@/lib/warehouse-options";
import { resolveWarehouseId } from "@/lib/warehouse-service";
import { roundMoney } from "@/lib/sale-payment-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import type { MobileSession } from "./mobile-auth-guards";
import { mobileRoleAllows } from "./mobile-permission-policy";
import { MobilePosError } from "./mobile-pos-errors";
import { resolveMobilePosCheckoutStatus } from "./mobile-pos-checkout-status";
import type { UserRole } from "@prisma/client";

const SEARCH_PAGE_SIZE = 24;
const CUSTOMER_PAGE_SIZE = 20;
const SEARCH_MIN_CHARS = 2;

export type MobilePosPermissions = {
  canSell: boolean;
  canApplyDiscount: boolean;
  canSelectWarehouse: boolean;
  canSelectCustomer: boolean;
  canViewCustomerBalance: boolean;
};

export function resolveMobilePosPermissions(
  role: string,
  isOwner: boolean
): MobilePosPermissions {
  const userRole = role as UserRole;
  const canPos = canAccessModule(userRole, "pos", isOwner);
  const canSell = canPos && mobileRoleAllows(role, "sales", "write");
  const canCustomers =
    canAccessModule(userRole, "customers", isOwner) &&
    mobileRoleAllows(role, "customers", "read");

  return {
    canSell,
    canApplyDiscount: canSell,
    canSelectWarehouse:
      canSell && canAccessModule(userRole, "stocks", isOwner),
    canSelectCustomer: canSell && canCustomers,
    canViewCustomerBalance:
      canCustomers && canAccessModule(userRole, "invoices", isOwner),
  };
}

export async function getMobilePosBootstrap(
  companyId: string,
  role: string,
  isOwner: boolean
) {
  const permissions = resolveMobilePosPermissions(role, isOwner);

  if (!permissions.canSell) {
    throw new MobilePosError("FORBIDDEN", "POS satış yetkiniz yok.", 403);
  }

  const [company, warehouseData, accounts] = await Promise.all([
    db.company.findFirst({
      where: { id: companyId, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
    getWarehouseOptions(companyId),
    getPosCollectionAccountOptions(companyId),
  ]);

  if (!company) {
    throw new MobilePosError("COMPANY_NOT_FOUND", "Firma bulunamadı.", 404);
  }

  const posSettings = getPosBootstrapSettings();

  return {
    company: {
      id: company.id,
      name: company.name,
      currency: "TRY" as const,
    },
    permissions,
    warehouses: warehouseData.warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      isDefault: w.isDefault,
    })),
    defaultWarehouseId: warehouseData.defaultWarehouseId,
    paymentMethods: posSettings.paymentMethods.value,
    collectionAccounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      isDefault: a.isDefault,
    })),
    settings: serializePosBootstrapSettingsForMobile(),
  };
}

function mapProductUnit(unitType: string) {
  if (unitType === "KG") return "kg";
  if (unitType === "LITER") return "lt";
  if (unitType === "METER") return "m";
  if (unitType === "BOX") return "kutu";
  return "adet";
}

function serializeSearchItem(
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    sellPrice: { toString(): string };
    vatRate: number;
    imageUrl: string | null;
    status: string;
    productType: string;
    unitType: string;
  },
  availableStock: number
) {
  return {
    productId: product.id,
    variantId: null as string | null,
    name: product.name,
    variantName: null as string | null,
    sku: product.sku,
    barcode: product.barcode,
    unit: mapProductUnit(product.unitType),
    price: Number(product.sellPrice),
    taxRate: product.vatRate,
    availableStock,
    imageUrl: product.imageUrl,
    status: product.status,
    stockTracked: !isServiceProductType(product.productType),
  };
}

async function assertWarehouseScope(companyId: string, warehouseId: string) {
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!warehouse) {
    throw new MobilePosError("WAREHOUSE_NOT_FOUND", "Depo bulunamadı.", 404);
  }
  return warehouse.id;
}

export async function searchMobilePosProducts(input: {
  companyId: string;
  q?: string;
  cursor?: string;
  warehouseId?: string;
}) {
  const { companyId } = input;
  const q = input.q?.trim() ?? "";

  if (q.length > 0 && q.length < SEARCH_MIN_CHARS) {
    throw new MobilePosError(
      "VALIDATION_ERROR",
      `Arama en az ${SEARCH_MIN_CHARS} karakter olmalıdır.`,
      400
    );
  }

  const resolvedWarehouseId = input.warehouseId
    ? await assertWarehouseScope(companyId, input.warehouseId)
    : await resolveWarehouseId(companyId, null);

  const where = {
    companyId,
    status: "ACTIVE" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(input.cursor ? { id: { lt: input.cursor } } : {}),
  };

  const products = await db.product.findMany({
    where,
    orderBy: { id: "desc" },
    take: SEARCH_PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellPrice: true,
      vatRate: true,
      imageUrl: true,
      status: true,
      productType: true,
      unitType: true,
      stock: true,
    },
  });

  const page = products.slice(0, SEARCH_PAGE_SIZE);
  const stockMap = await getWarehouseStockByProductIds(
    companyId,
    resolvedWarehouseId,
    page.map((p) => p.id)
  );

  const items = page.map((product) =>
    serializeSearchItem(
      product,
      isServiceProductType(product.productType)
        ? 0
        : (stockMap[product.id] ?? 0)
    )
  );

  const nextCursor =
    products.length > SEARCH_PAGE_SIZE ? page[page.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}

export function normalizePosBarcode(raw: string) {
  return raw.trim().replace(/\s+/g, "");
}

export async function lookupMobilePosBarcode(input: {
  companyId: string;
  barcode: string;
  warehouseId?: string;
}) {
  const normalized = normalizePosBarcode(input.barcode);
  if (!normalized) {
    throw new MobilePosError("VALIDATION_ERROR", "Geçersiz barkod.", 400);
  }

  const resolvedWarehouseId = input.warehouseId
    ? await assertWarehouseScope(input.companyId, input.warehouseId)
    : await resolveWarehouseId(input.companyId, null);

  const products = await db.product.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
      OR: [
        { barcode: { equals: normalized, mode: "insensitive" } },
        { sku: { equals: normalized, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellPrice: true,
      vatRate: true,
      imageUrl: true,
      status: true,
      productType: true,
      unitType: true,
    },
  });

  if (products.length === 0) {
    throw new MobilePosError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }

  if (products.length > 1) {
    const stockMap = await getWarehouseStockByProductIds(
      input.companyId,
      resolvedWarehouseId,
      products.map((p) => p.id)
    );
    return {
      conflict: true as const,
      items: products.map((product) =>
        serializeSearchItem(
          product,
          isServiceProductType(product.productType)
            ? 0
            : (stockMap[product.id] ?? 0)
        )
      ),
    };
  }

  const product = products[0]!;
  const stockMap = await getWarehouseStockByProductIds(
    input.companyId,
    resolvedWarehouseId,
    [product.id]
  );

  return {
    conflict: false as const,
    item: serializeSearchItem(
      product,
      isServiceProductType(product.productType)
        ? 0
        : (stockMap[product.id] ?? 0)
    ),
  };
}

export async function searchMobilePosCustomers(input: {
  companyId: string;
  q?: string;
  cursor?: string;
  canViewBalance: boolean;
}) {
  const q = input.q?.trim() ?? "";

  const customers = await db.customer.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(input.cursor ? { id: { lt: input.cursor } } : {}),
    },
    orderBy: { id: "desc" },
    take: CUSTOMER_PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      balance: true,
    },
  });

  const page = customers.slice(0, CUSTOMER_PAGE_SIZE);
  const nextCursor =
    customers.length > CUSTOMER_PAGE_SIZE
      ? page[page.length - 1]?.id ?? null
      : null;

  return {
    items: page.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      balance: input.canViewBalance ? Number(c.balance) : null,
    })),
    nextCursor,
  };
}

export async function validateMobilePosCheckoutPrices(
  companyId: string,
  items: PosCheckoutInput["items"]
) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { companyId, id: { in: productIds }, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      sellPrice: true,
      vatRate: true,
      status: true,
    },
  });

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new MobilePosError(
        "PRODUCT_NOT_FOUND",
        `Ürün bulunamadı: ${item.name}`,
        404
      );
    }

    const dbPrice = roundMoney(Number(product.sellPrice));
    const clientPrice = roundMoney(item.unitPrice);
    if (dbPrice !== clientPrice) {
      throw new MobilePosError(
        "PRICE_CHANGED",
        `${product.name} fiyatı güncellendi. Sepeti kontrol edin.`,
        409
      );
    }

    if (product.vatRate !== item.vatRate) {
      throw new MobilePosError(
        "PRICE_CHANGED",
        `${product.name} KDV oranı güncellendi. Sepeti kontrol edin.`,
        409
      );
    }
  }
}

export async function executeMobilePosCheckout(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  data: PosCheckoutInput;
}) {
  const permissions = resolveMobilePosPermissions(input.role, input.isOwner);
  if (!permissions.canSell) {
    throw new MobilePosError("FORBIDDEN", "POS satış yetkiniz yok.", 403);
  }

  if (input.data.discount > 0 && !permissions.canApplyDiscount) {
    throw new MobilePosError("INVALID_DISCOUNT", "İndirim uygulama yetkiniz yok.", 403);
  }

  if (input.data.warehouseId && !permissions.canSelectWarehouse) {
    throw new MobilePosError("FORBIDDEN", "Depo seçme yetkiniz yok.", 403);
  }

  if (input.data.customerId && !permissions.canSelectCustomer) {
    throw new MobilePosError("FORBIDDEN", "Müşteri seçme yetkiniz yok.", 403);
  }

  await validateMobilePosCheckoutPrices(input.companyId, input.data.items);

  const result = await executePosCheckout({
    companyId: input.companyId,
    userId: input.userId,
    data: input.data,
  });

  const total = Number(result.sale.total);
  const paidAmount = Number(result.sale.paidAmount);

  return {
    sale: {
      id: result.sale.id,
      saleNumber: result.sale.saleNo,
      createdAt: result.sale.createdAt.toISOString(),
      total,
      paidAmount,
      remainingAmount: getInvoiceRemainingAmount(total, paidAmount),
      currency: "TRY" as const,
      paymentStatus: result.sale.paymentStatus,
      itemCount: result.sale.items.length,
      payments: result.sale.payments.map((p) => ({
        method: p.paymentMethod,
        amount: Number(p.amount),
        accountName: p.account.name,
      })),
    },
    replayed: result.replayed,
  };
}

export async function getMobilePosCheckoutStatus(
  companyId: string,
  idempotencyKey: string,
  payloadHash?: string | null
) {
  return resolveMobilePosCheckoutStatus({
    companyId,
    idempotencyKey,
    payloadHash,
  });
}

export async function getMobileSaleDetail(companyId: string, saleId: string) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      user: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          vatRate: true,
          total: true,
        },
      },
      payments: {
        include: {
          account: { select: { id: true, name: true, type: true } },
        },
      },
    },
  });

  if (!sale) {
    throw new MobilePosError("NOT_FOUND", "Satış bulunamadı.", 404);
  }

  return {
    id: sale.id,
    saleNumber: sale.saleNo,
    createdAt: sale.createdAt.toISOString(),
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    vatTotal: Number(sale.vatTotal),
    total: Number(sale.total),
    paidAmount: Number(sale.paidAmount),
    remainingAmount: getInvoiceRemainingAmount(
      Number(sale.total),
      Number(sale.paidAmount)
    ),
    currency: "TRY" as const,
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          email: sale.customer.email,
        }
      : null,
    userName: sale.user?.name ?? null,
    items: sale.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      taxRate: item.vatRate,
      lineTotal: Number(item.total),
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.paymentMethod,
      amount: Number(p.amount),
      accountName: p.account.name,
    })),
  };
}

export async function requireMobilePosSellAccess(
  session: MobileSession,
  membership: { role: string; isOwner: boolean }
) {
  if (session.role === "SUPER_ADMIN") {
    throw new MobilePosError("FORBIDDEN", "Super Admin mobil POS kullanamaz.", 403);
  }

  const permissions = resolveMobilePosPermissions(
    membership.role,
    membership.isOwner
  );
  if (!permissions.canSell) {
    throw new MobilePosError("FORBIDDEN", "POS satış yetkiniz yok.", 403);
  }

  return permissions;
}
