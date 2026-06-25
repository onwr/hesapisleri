import { aiAdminStatsHandler } from "@/lib/ai/ai-api-handlers";

export async function GET() {
  return aiAdminStatsHandler();
}
