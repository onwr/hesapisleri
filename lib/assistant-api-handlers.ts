import { aiChatHandler } from "@/lib/ai/ai-api-handlers";

export async function assistantChatHandler(req: Request) {
  return aiChatHandler(req);
}
