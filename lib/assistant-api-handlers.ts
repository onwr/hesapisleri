import { NextResponse } from "next/server";
import {
  AssistantConfigError,
  assistantChatBodySchema,
  generateAssistantReply,
  getAssistantProviderMode,
  loadAssistantContext,
  resolveAssistantDateRange,
} from "@/lib/assistant-service";
import { requireApiModuleAccess } from "@/lib/module-access";

export async function assistantChatHandler(req: Request) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek gövdesi." },
        { status: 400 }
      );
    }

    const parsed = assistantChatBodySchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message || "Geçersiz mesaj.";
      return NextResponse.json({ success: false, message }, { status: 400 });
    }

    if (getAssistantProviderMode() === "missing") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Yapay zeka servisi yapılandırılmamış. Lütfen API anahtarını kontrol edin.",
        },
        { status: 503 }
      );
    }

    const { message, context: topic, from, to } = parsed.data;
    const range = resolveAssistantDateRange(from, to);
    const aiContext = await loadAssistantContext(auth.companyId, {
      from: range.from,
      to: range.to,
      userName: auth.session.user.name,
    });

    const result = await generateAssistantReply(message, aiContext, {
      topic,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      provider: result.provider,
    });
  } catch (error) {
    if (error instanceof AssistantConfigError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 503 }
      );
    }

    console.error("[assistant/chat]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Asistan şu anda cevap veremiyor. Lütfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}
