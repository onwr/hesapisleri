import { aiTestConnectionHandler } from "@/lib/ai/ai-api-handlers";

export async function POST() {
  return aiTestConnectionHandler();
}
