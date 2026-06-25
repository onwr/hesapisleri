import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { loadAssistantContext } from "@/lib/assistant-service";
import { buildSafeContextSummary } from "@/lib/assistant-service";
import type { AiPermissionContext } from "@/lib/ai/ai-permission-service";

export type AiRuntimeContext = AiPermissionContext & {
  userName: string;
  from: Date;
  to: Date;
  topic?: string;
};

export async function buildAiRuntimeContext(input: {
  companyId: string;
  userId: string;
  userName: string;
  effectiveRole: AiPermissionContext["effectiveRole"];
  isOwner: boolean;
  readOnlyMode: boolean;
  from?: Date;
  to?: Date;
  topic?: string;
}): Promise<AiRuntimeContext> {
  const now = new Date();
  return {
    companyId: input.companyId,
    userId: input.userId,
    userName: input.userName,
    effectiveRole: input.effectiveRole,
    isOwner: input.isOwner,
    readOnlyMode: input.readOnlyMode,
    from: input.from || startOfMonth(now),
    to: input.to || endOfMonth(now),
    topic: input.topic,
  };
}

export async function buildLegacyContextSummary(
  companyId: string,
  options: { from: Date; to: Date; userName: string }
) {
  const context = await loadAssistantContext(companyId, options);
  return buildSafeContextSummary(context);
}

export function buildSystemPrompt(input: {
  userName: string;
  topic?: string;
  readOnlyMode: boolean;
  language: string;
}) {
  return [
    "Sen Hesapisleri.com için Türkçe konuşan bir işletme asistanısın.",
    `Kullanıcı: ${input.userName}`,
    `Dil: ${input.language}`,
    `Odak: ${input.topic || "genel"}`,
    "Yalnızca izin verilen salt-okunur araçları kullanarak şirket verilerini sorgula.",
    "SQL, Prisma veya ham veritabanı sorgusu üretme ve çalıştırma.",
    "Satış oluşturma, stok değiştirme, tahsilat, ödeme, fatura gönderme gibi yazma işlemleri yapma.",
    "Yazma gerektiren durumlarda yalnızca action_proposal öner.",
    "Veri yoksa bunu açıkça belirt; tahmin yapma.",
    "Hassas bilgileri (API anahtarı, parola, token) asla gösterme.",
  ].join("\n");
}
