import {
  aiConversationDetailHandler,
  aiConversationPatchHandler,
  aiConversationDeleteHandler,
} from "@/lib/ai/ai-api-handlers";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params;
  return aiConversationDetailHandler(id);
}

export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params;
  return aiConversationPatchHandler(id, req);
}

export async function DELETE(_req: Request, { params }: Props) {
  const { id } = await params;
  return aiConversationDeleteHandler(id);
}
