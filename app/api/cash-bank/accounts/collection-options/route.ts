import { collectionAccountOptionsHandler } from "@/lib/account-api-handlers";

export async function GET() {
  return collectionAccountOptionsHandler();
}
