import { aiChatHandler } from "@/lib/ai/ai-api-handlers";

export async function POST(req: Request) {
  return aiChatHandler(req);
}
