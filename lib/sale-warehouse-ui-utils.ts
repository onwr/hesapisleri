export type ProductWithWarehouseStock = {
  stock: number;
  warehouseStock?: number;
};

export function getSaleProductStock(
  product: ProductWithWarehouseStock,
  warehouseSelected: boolean
) {
  if (warehouseSelected && product.warehouseStock !== undefined) {
    return product.warehouseStock;
  }

  return product.stock;
}

export function buildProductsListUrl(warehouseId?: string) {
  if (!warehouseId) {
    return "/api/products/list";
  }

  return `/api/products/list?warehouseId=${encodeURIComponent(warehouseId)}`;
}
