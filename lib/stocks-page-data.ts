import { db } from "@/lib/prisma";
import { buildWarehouseMetrics } from "@/lib/warehouse-service";
import {
  buildCategoryTotals,
  buildStockDistribution,
  buildStockStatCards,
  buildStocksExportQuery,
  buildStocksQuery,
  filterMovementsByTab,
  filterProductsByTab,
  isInDateRange,
  isLowStock,
  isMovementTab,
  isTransferTab,
  isWarehouseTab,
  mapMovementToRow,
  mapProductToStockRow,
  mapTransferToRow,
  mapWarehouseToRow,
  matchesMovementSearch,
  matchesProductSearch,
  type StockActionCard,
  type StockCategoryItem,
  type StockDistributionItem,
  type StockMovementRow,
  type StockProductRow,
  type StockStatCard,
  type StockTabKey,
  type StockTransferRow,
  type StockWarehouseRow,
} from "@/lib/stocks-page-utils";

export type {
  StockActionCard,
  StockCategoryItem,
  StockDistributionItem,
  StockMovementRow,
  StockProductRow,
  StockStatCard,
  StockTabKey,
  StockTransferRow,
  StockWarehouseRow,
} from "@/lib/stocks-page-utils";

export {
  DEFAULT_MIN_STOCK_FALLBACK,
  CRITICAL_STOCK_LEVEL,
  STOCK_TAB_LABELS,
  buildStocksExportQuery,
  buildStocksQuery,
  formatDateDisplay,
  formatDateInputValue,
  formatStockDateTime,
  formatStockMoney,
  formatStockNumber,
  getCategoryBadge,
  getMovementClass,
  getMovementSoftClass,
  formatMovementQuantityForDisplay,
  getMovementText,
  getStockStatus,
  isLowStock,
  resolveProductMinStock,
  isMovementTab,
  isTransferTab,
  isWarehouseTab,
  normalizeDateRange,
  parseDateParam,
  parsePage,
  parseSearchQuery,
  parseStockTab,
} from "@/lib/stocks-page-utils";

const PAGE_SIZE = 10;

function buildActionCards(): StockActionCard[] {
  return [
    {
      title: "Stok Girişi",
      description: "Ürün ve depo seçerek stok girişi yapın",
      iconKey: "in",
      gradient: "from-emerald-500 to-green-600",
      action: "movement-in",
    },
    {
      title: "Stok Çıkışı",
      description: "Ürün ve depo seçerek stok çıkışı yapın",
      iconKey: "out",
      gradient: "from-blue-500 to-blue-600",
      action: "movement-out",
    },
    {
      title: "Stok Sayımı",
      description: "Depo bazlı sayım kaydı oluşturun",
      iconKey: "count",
      gradient: "from-orange-400 to-orange-600",
      action: "movement-count",
    },
    {
      title: "Depo Transferi",
      description: "Depolar arası stok transferi başlatın",
      iconKey: "transfer",
      gradient: "from-violet-500 to-purple-600",
      action: "transfer",
    },
    {
      title: "Yeni Ürün",
      description: "Ürün kartı oluştur",
      href: "/products/new",
      iconKey: "plus",
      gradient: "from-rose-400 to-pink-600",
    },
  ];
}

function matchesTransferSearch(row: StockTransferRow, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    row.transferNo.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.productName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.fromWarehouseName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.toWarehouseName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (row.note?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false)
  );
}

function matchesWarehouseSearch(row: StockWarehouseRow, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    row.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (row.code?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false)
  );
}

export async function getStocksPageData(
  companyId: string,
  options: {
    tab: StockTabKey;
    page: number;
    from: Date;
    to: Date;
    q?: string | null;
    productId?: string | null;
  }
) {
  const [productsRaw, movementsRaw, transfersRaw, warehousesRaw] =
    await Promise.all([
      db.product.findMany({
        where: { companyId, productType: "STOCK" },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
      db.stockMovement.findMany({
        where: { companyId },
        include: {
          warehouse: { select: { name: true } },
          product: {
            include: { category: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.warehouseTransfer.findMany({
        where: { companyId },
        include: {
          product: { select: { id: true, name: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          items: { select: { productId: true, quantity: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.warehouse.findMany({
        where: { companyId },
        include: {
          stocks: {
            include: {
              product: {
                select: {
                  buyPrice: true,
                  productType: true,
                  minStock: true,
                  stock: true,
                },
              },
            },
          },
        },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
    ]);

  const allProducts = productsRaw.map((product, index) =>
    mapProductToStockRow(product, index)
  );

  const allMovements = movementsRaw.map(mapMovementToRow);
  const allTransfers = transfersRaw.map(mapTransferToRow);
  const allWarehouses = warehousesRaw.map((warehouse) =>
    mapWarehouseToRow(warehouse, buildWarehouseMetrics(warehouse))
  );

  const activeProducts = productsRaw.filter(
    (product) => product.status === "ACTIVE"
  ).length;

  const totalStock = allProducts.reduce((sum, product) => sum + product.stock, 0);
  const totalStockValue = allProducts.reduce(
    (sum, product) => sum + product.stockValue,
    0
  );
  const lowStockCount = allProducts.filter((p) =>
    isLowStock(p.stock, p.criticalLevel)
  ).length;
  const outOfStockCount = allProducts.filter((p) => p.stock <= 0).length;

  const statCards = buildStockStatCards({
    totalProducts: allProducts.length,
    activeProducts,
    totalStock,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
  });

  const distribution = buildStockDistribution(allProducts);
  const categoryTotals = buildCategoryTotals(allProducts);

  const periodMovements = allMovements.filter((movement) =>
    isInDateRange(movement.createdAt, options.from, options.to)
  );

  const periodTransfers = allTransfers.filter((transfer) =>
    isInDateRange(transfer.createdAt, options.from, options.to)
  );

  const recentMovements = periodMovements.slice(0, 5);

  const movementMode = isMovementTab(options.tab);
  const transferMode = isTransferTab(options.tab);
  const warehouseMode = isWarehouseTab(options.tab);

  let filteredProducts = filterProductsByTab(allProducts, options.tab);
  let filteredMovements = filterMovementsByTab(periodMovements, options.tab);
  let filteredTransfers = periodTransfers;
  let filteredWarehouses = allWarehouses;

  if (options.productId) {
    filteredProducts = filteredProducts.filter(
      (row) => row.id === options.productId
    );
    filteredMovements = filteredMovements.filter(
      (row) => row.productId === options.productId
    );
    filteredTransfers = filteredTransfers.filter(
      (row) => row.productId === options.productId
    );
  }

  if (options.q) {
    if (movementMode) {
      filteredMovements = filteredMovements.filter((row) =>
        matchesMovementSearch(row, options.q!)
      );
    } else if (transferMode) {
      filteredTransfers = filteredTransfers.filter((row) =>
        matchesTransferSearch(row, options.q!)
      );
    } else if (warehouseMode) {
      filteredWarehouses = filteredWarehouses.filter((row) =>
        matchesWarehouseSearch(row, options.q!)
      );
    } else {
      filteredProducts = filteredProducts.filter((row) =>
        matchesProductSearch(row, options.q!)
      );
    }
  }

  const totalRecords = movementMode
    ? filteredMovements.length
    : transferMode
      ? filteredTransfers.length
      : warehouseMode
        ? filteredWarehouses.length
        : filteredProducts.length;

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const productRows =
    movementMode || transferMode || warehouseMode
      ? []
      : filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);

  const movementRows = movementMode
    ? filteredMovements.slice(startIndex, startIndex + PAGE_SIZE)
    : [];

  const transferRows = transferMode
    ? filteredTransfers.slice(startIndex, startIndex + PAGE_SIZE)
    : [];

  const warehouseRows = warehouseMode
    ? filteredWarehouses.slice(startIndex, startIndex + PAGE_SIZE)
    : [];

  const exportHref = buildStocksExportQuery({
    tab: options.tab,
    from: options.from,
    to: options.to,
    q: options.q,
    productId: options.productId,
  });

  const stockInTotal = periodMovements
    .filter((m) => m.type === "IN" || m.type === "RETURN")
    .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

  const stockOutTotal = periodMovements
    .filter((m) => m.type === "OUT" || m.type === "SALE")
    .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

  return {
    productRows,
    movementRows,
    transferRows,
    warehouseRows,
    statCards,
    actionCards: buildActionCards(),
    distribution,
    categoryTotals,
    recentMovements,
    totalStock,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
    exportHref,
    movementMode,
    transferMode,
    warehouseMode,
    stockInTotal,
    stockOutTotal,
    warehouseCount: allWarehouses.length,
  };
}

export async function getStocksExportRows(
  companyId: string,
  options: {
    tab: StockTabKey;
    from: Date;
    to: Date;
    q?: string | null;
  }
) {
  if (isTransferTab(options.tab)) {
    const transfersRaw = await db.warehouseTransfer.findMany({
      where: { companyId },
      include: {
        product: { select: { id: true, name: true } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        items: { select: { productId: true, quantity: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let transfers = transfersRaw
      .map(mapTransferToRow)
      .filter((transfer) =>
        isInDateRange(transfer.createdAt, options.from, options.to)
      );

    if (options.q) {
      transfers = transfers.filter((row) =>
        matchesTransferSearch(row, options.q!)
      );
    }

    return { mode: "transfers" as const, transfers };
  }

  if (isMovementTab(options.tab)) {
    const movementsRaw = await db.stockMovement.findMany({
      where: { companyId },
      include: {
        warehouse: { select: { name: true } },
        product: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let movements = movementsRaw
      .map(mapMovementToRow)
      .filter((movement) =>
        isInDateRange(movement.createdAt, options.from, options.to)
      );

    movements = filterMovementsByTab(movements, options.tab);

    if (options.q) {
      movements = movements.filter((row) =>
        matchesMovementSearch(row, options.q!)
      );
    }

    return { mode: "movements" as const, movements };
  }

  const productsRaw = await db.product.findMany({
    where: { companyId, productType: "STOCK" },
    include: {
      category: true,
      warehouseStocks: {
        include: { warehouse: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let products = productsRaw.map((product, index) =>
    mapProductToStockRow(product, index)
  );

  products = filterProductsByTab(products, options.tab);

  if (options.q) {
    products = products.filter((row) => matchesProductSearch(row, options.q!));
  }

  const warehouseDistribution = productsRaw.map((product) => ({
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    totalStock: product.stock,
    warehouses: product.warehouseStocks
      .filter((ws) => ws.quantity > 0)
      .map((ws) => ({
        name: ws.warehouse.name,
        quantity: ws.quantity,
      })),
  }));

  return {
    mode: "products" as const,
    products,
    warehouseDistribution,
  };
}

export async function getStockFormOptions(companyId: string) {
  const [products, warehouses] = await Promise.all([
    db.product.findMany({
      where: { companyId, status: "ACTIVE", productType: "STOCK" },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
      },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({
      where: { companyId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        isDefault: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  return { products, warehouses };
}
