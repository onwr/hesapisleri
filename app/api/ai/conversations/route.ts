import { aiConversationsGetHandler } from "@/lib/ai/ai-api-handlers";

export async function GET() {
  return aiConversationsGetHandler();
}
