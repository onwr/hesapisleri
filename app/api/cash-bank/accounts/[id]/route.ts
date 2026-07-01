import {
  accountDeactivateHandler,
  accountDetailHandler,
  accountUpdateHandler,
} from "@/lib/account-api-handlers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  return accountDetailHandler(id);
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  return accountUpdateHandler(req, id);
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;
  return accountDeactivateHandler(req, id);
}
