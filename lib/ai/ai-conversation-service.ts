import { db } from "@/lib/prisma";
import { AiServiceError } from "@/lib/ai/ai-errors";

export async function updateConversationTitle(input: {
  companyId: string;
  userId: string;
  conversationId: string;
  title: string;
}) {
  const title = input.title.trim();
  if (!title) {
    throw new AiServiceError("TOOL_VALIDATION_FAILED", 400);
  }

  const conversation = await db.aIConversation.findFirst({
    where: {
      id: input.conversationId,
      companyId: input.companyId,
      userId: input.userId,
    },
  });
  if (!conversation) {
    throw new AiServiceError("CONVERSATION_NOT_FOUND", 404);
  }

  return db.aIConversation.update({
    where: { id: conversation.id },
    data: { title: title.slice(0, 120) },
  });
}

export async function deleteConversation(input: {
  companyId: string;
  userId: string;
  conversationId: string;
}) {
  const conversation = await db.aIConversation.findFirst({
    where: {
      id: input.conversationId,
      companyId: input.companyId,
      userId: input.userId,
    },
  });
  if (!conversation) {
    throw new AiServiceError("CONVERSATION_NOT_FOUND", 404);
  }

  await db.aIConversation.delete({ where: { id: conversation.id } });
  return { deleted: true };
}

export type ConversationListItem = {
  id: string;
  title: string | null;
  provider: string | null;
  model: string | null;
  updatedAt: Date;
  preview: string | null;
};

export function groupConversationsByDate(conversations: ConversationListItem[]) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const groups: Array<{ label: string; items: ConversationListItem[] }> = [
    { label: "Bugün", items: [] },
    { label: "Dün", items: [] },
    { label: "Bu hafta", items: [] },
    { label: "Daha eski", items: [] },
  ];

  for (const item of conversations) {
    const updated = new Date(item.updatedAt);
    if (updated >= startOfToday) groups[0].items.push(item);
    else if (updated >= startOfYesterday) groups[1].items.push(item);
    else if (updated >= startOfWeek) groups[2].items.push(item);
    else groups[3].items.push(item);
  }

  return groups.filter((group) => group.items.length > 0);
}
