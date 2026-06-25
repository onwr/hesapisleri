import { financeAccountOptionsHandler } from "@/lib/account-api-handlers";

export async function GET() {
  return financeAccountOptionsHandler();
}
