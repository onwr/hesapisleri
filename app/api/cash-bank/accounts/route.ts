import {
  accountCreateHandler,
  accountListHandler,
} from "@/lib/account-api-handlers";

export async function GET() {
  return accountListHandler();
}

export async function POST(req: Request) {
  return accountCreateHandler(req);
}
