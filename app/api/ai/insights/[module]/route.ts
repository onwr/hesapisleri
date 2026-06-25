import { aiModuleInsightHandler } from "@/lib/ai/ai-api-handlers";

type Props = { params: Promise<{ module: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { module } = await params;
  return aiModuleInsightHandler(module);
}
