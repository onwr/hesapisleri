import { applyWarehouseStockMovement } from "@/lib/warehouse-service";
import type { StockMovementRequestInput } from "@/lib/stock-movement-utils";

type ApplyStockMovementParams = {
  companyId: string;
  userId: string;
  productId: string;
  input: StockMovementRequestInput & { warehouseId?: string };
};

export async function applyProductStockMovement(params: ApplyStockMovementParams) {
  return applyWarehouseStockMovement(params);
}
