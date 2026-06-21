import { accountSetDefaultHandler } from "@/lib/account-api-handlers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  return accountSetDefaultHandler(id);
}
