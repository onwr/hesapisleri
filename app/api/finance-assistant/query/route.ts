import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { financeQuerySchema } from "@/lib/finance-assistant/commands";
import { runFinanceCommand } from "@/lib/finance-assistant/service";
import { assertAiChatRateLimits } from "@/lib/ai/ai-rate-limit-service";
import { AiServiceError } from "@/lib/ai/ai-errors";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;

    const { companyId, userId } = auth;

    await assertAiChatRateLimits(companyId, userId);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek gövdesi." },
        { status: 400 }
      );
    }

    const parsed = financeQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz parametreler.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await runFinanceCommand(companyId, parsed.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof AiServiceError && error.status === 429) {
      return NextResponse.json(
        { success: false, message: "Çok fazla istek gönderildi. Lütfen bekleyin." },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : "Analiz çalıştırılamadı.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
