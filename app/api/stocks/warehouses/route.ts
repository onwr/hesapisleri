import {
  warehouseCreateHandler,
  warehouseListHandler,
} from "@/lib/warehouse-api-handlers";

export async function GET() {
  return warehouseListHandler();
}

export async function POST(req: Request) {
  return warehouseCreateHandler(req);
}
