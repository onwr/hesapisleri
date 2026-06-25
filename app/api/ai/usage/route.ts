import { aiUsageGetHandler } from "@/lib/ai/ai-api-handlers";

export async function GET() {
  return aiUsageGetHandler();
}
