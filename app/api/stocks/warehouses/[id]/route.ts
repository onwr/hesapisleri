import {
  warehouseDeleteHandler,
  warehouseGetHandler,
  warehouseUpdateHandler,
} from "@/lib/warehouse-api-handlers";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  return warehouseGetHandler(id);
}

export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params;
  return warehouseUpdateHandler(req, id);
}

export async function DELETE(_req: Request, { params }: Props) {
  const { id } = await params;
  return warehouseDeleteHandler(id);
}
