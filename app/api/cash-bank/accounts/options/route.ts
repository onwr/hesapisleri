import { accountOptionsHandler } from "@/lib/account-api-handlers";

export async function GET() {
  return accountOptionsHandler();
}
