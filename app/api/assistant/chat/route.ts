import { assistantChatHandler } from "@/lib/assistant-api-handlers";

export async function POST(req: Request) {
  return assistantChatHandler(req);
}
