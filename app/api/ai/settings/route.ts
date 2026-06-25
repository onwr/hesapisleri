import {
  aiSettingsGetHandler,
  aiSettingsPatchHandler,
} from "@/lib/ai/ai-api-handlers";

export async function GET() {
  return aiSettingsGetHandler();
}

export async function PATCH(req: Request) {
  return aiSettingsPatchHandler(req);
}
