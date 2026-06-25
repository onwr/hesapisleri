import { NextResponse } from "next/server";
import { z } from "zod";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { runAiChat, listUserConversations, getConversationMessages } from "@/lib/ai/ai-chat-service";
import {
  updateConversationTitle,
  deleteConversation,
} from "@/lib/ai/ai-conversation-service";
import { buildAiHealthReport, testAiConnection } from "@/lib/ai/ai-health-service";
import {
  getCompanyAiSettingsView,
  updateCompanyAiSettings,
  updateCompanyAiSettingsSchema,
} from "@/lib/ai/ai-settings-service";
import {
  getMonthlyAiUsageSummary,
  getCompanyUsageStats,
} from "@/lib/ai/ai-usage-service";
import { getMonthlyCostAlertStatus } from "@/lib/ai/ai-cost-alert-service";
import { getAiRateLimitStatus } from "@/lib/ai/ai-rate-limit-service";
import { getAiAdminStats } from "@/lib/ai/ai-admin-stats-service";
import { generateModuleInsightCommentary } from "@/lib/ai/ai-insight-commentary-service";
import { canViewAiUsageStats } from "@/lib/ai/ai-permission-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { canManageSettings } from "@/lib/permission-utils";
import { resolveAssistantDateRange } from "@/lib/assistant-service";
import { ASSISTANT_MESSAGE_MAX_LENGTH } from "@/lib/assistant-service";
import {
  getDashboardSummary,
  getSalesSummary,
} from "@/lib/ai/ai-read-tools";
import {
  getOrBuildDashboardExecutiveSummary,
} from "@/lib/ai/ai-insight-cache-service";
import { buildAiRuntimeContext } from "@/lib/ai/ai-context-builder";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(ASSISTANT_MESSAGE_MAX_LENGTH),
  conversationId: z.string().optional(),
  context: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function aiHealthHandler() {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;
    const health = await buildAiHealthReport(auth.companyId);
    return NextResponse.json({ success: true, data: health });
  } catch (error) {
    console.error("[ai/health]", error);
    return NextResponse.json(
      { success: false, message: "Sağlık durumu alınamadı." },
      { status: 500 }
    );
  }
}

export async function aiChatHandler(req: Request) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Geçersiz istek." },
        { status: 400 }
      );
    }

    const range = resolveAssistantDateRange(parsed.data.from, parsed.data.to);
    const result = await runAiChat({
      companyId: auth.companyId,
      userId: auth.userId,
      userName: auth.session.user.name,
      effectiveRole: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      from: range.from,
      to: range.to,
      topic: parsed.data.context,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      structured: result.structured,
      provider: result.provider,
      model: result.model,
      conversationId: result.conversationId,
      toolNames: result.toolNames,
      responseMode: result.responseMode,
      fallbackNotice: result.fallbackNotice,
    });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[ai/chat]", error);
    return NextResponse.json(
      { success: false, message: "Asistan şu anda cevap veremiyor. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}

export async function aiTestConnectionHandler() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;
    if (
      !canManageSettings(
        auth.session.effectiveRole,
        auth.session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }
    const result = await testAiConnection(auth.companyId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[ai/test-connection]", error);
    return NextResponse.json(
      { success: false, message: "Bağlantı testi başarısız." },
      { status: 500 }
    );
  }
}

export async function aiSettingsGetHandler() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;
    const data = await getCompanyAiSettingsView(auth.companyId);
    const health = await buildAiHealthReport(auth.companyId);
    const usage = await getMonthlyAiUsageSummary(auth.companyId);
    const costAlert = await getMonthlyCostAlertStatus(auth.companyId);
    const rateLimits = await getAiRateLimitStatus(auth.companyId, auth.userId);
    return NextResponse.json({
      success: true,
      data: { settings: data, health, usage, costAlert, rateLimits },
    });
  } catch (error) {
    console.error("[ai/settings]", error);
    return NextResponse.json(
      { success: false, message: "AI ayarları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiSettingsPatchHandler(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;
    if (
      !canManageSettings(
        auth.session.effectiveRole,
        auth.session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }
    const body = await req.json();
    const parsed = updateCompanyAiSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz ayarlar." },
        { status: 400 }
      );
    }
    await updateCompanyAiSettings(auth.companyId, parsed.data);
    const data = await getCompanyAiSettingsView(auth.companyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ai/settings]", error);
    return NextResponse.json(
      { success: false, message: "AI ayarları kaydedilemedi." },
      { status: 500 }
    );
  }
}

export async function aiConversationsGetHandler() {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;
    const data = await listUserConversations(auth.companyId, auth.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ai/conversations]", error);
    return NextResponse.json(
      { success: false, message: "Konuşmalar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiConversationPatchHandler(conversationId: string, req: Request) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;
    const body = await req.json();
    const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Geçersiz başlık." }, { status: 400 });
    }
    const data = await updateConversationTitle({
      companyId: auth.companyId,
      userId: auth.userId,
      conversationId,
      title: parsed.data.title,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Konuşma güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function aiConversationDeleteHandler(conversationId: string) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;
    await deleteConversation({
      companyId: auth.companyId,
      userId: auth.userId,
      conversationId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Konuşma silinemedi." },
      { status: 500 }
    );
  }
}

export async function aiAdminStatsHandler() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;
    if (
      !canViewAiUsageStats(
        auth.session.effectiveRole,
        auth.session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }
    const data = await getAiAdminStats(auth.companyId, auth.userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ai/admin/stats]", error);
    return NextResponse.json(
      { success: false, message: "Admin istatistikleri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiConversationDetailHandler(conversationId: string) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;
    const data = await getConversationMessages(
      auth.companyId,
      auth.userId,
      conversationId
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AiServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("[ai/conversations/id]", error);
    return NextResponse.json(
      { success: false, message: "Konuşma yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiUsageGetHandler() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;
    if (
      !canViewAiUsageStats(
        auth.session.effectiveRole,
        auth.session.companyUser.isOwner
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 }
      );
    }
    const [monthly, recent, costAlert, rateLimits] = await Promise.all([
      getMonthlyAiUsageSummary(auth.companyId),
      getCompanyUsageStats(auth.companyId),
      getMonthlyCostAlertStatus(auth.companyId),
      getAiRateLimitStatus(auth.companyId, auth.userId),
    ]);
    return NextResponse.json({
      success: true,
      data: { monthly, recent, costAlert, rateLimits },
    });
  } catch (error) {
    console.error("[ai/usage]", error);
    return NextResponse.json(
      { success: false, message: "Kullanım istatistikleri yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiDashboardInsightHandler() {
  try {
    const auth = await requireApiModuleAccess("dashboard");
    if ("error" in auth) return auth.error;

    const settings = await getCompanyAiSettingsView(auth.companyId);
    const runtime = await buildAiRuntimeContext({
      companyId: auth.companyId,
      userId: auth.userId,
      userName: auth.session.user.name,
      effectiveRole: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
      readOnlyMode: settings.readOnlyMode,
    });

    const summary = await getOrBuildDashboardExecutiveSummary({
      companyId: auth.companyId,
      from: runtime.from,
      to: runtime.to,
      model: settings.model || settings.platformModel,
      builder: async () => {
        const [dashboard, sales] = await Promise.all([
          getDashboardSummary({}, runtime),
          getSalesSummary({ limit: 5 }, runtime),
        ]);

        const dash = dashboard as {
          totalSales: number;
          accountBalance: number;
          lowStockCount: number;
          pendingCollection: number;
          overdueInvoiceCount: number;
        };

        const commentary = await generateModuleInsightCommentary({
          companyId: auth.companyId,
          userId: auth.userId,
          userName: auth.session.user.name,
          effectiveRole: auth.session.effectiveRole,
          isOwner: auth.session.companyUser.isOwner,
          moduleKey: "dashboard",
          from: runtime.from,
          to: runtime.to,
        });

        return {
          generatedAt: commentary.generatedAt,
          provider: commentary.provider,
          model: commentary.model,
          blocks: commentary.blocks,
          commentary: commentary.commentary,
          sourceModules: commentary.sourceModules,
          period: commentary.period,
          responseMode: commentary.responseMode,
          metrics: {
            todaySales: (sales as { total?: number }).total || dash.totalSales,
            accountBalance: dash.accountBalance,
            lowStockCount: dash.lowStockCount,
            overdueCollection: dash.pendingCollection,
          },
        };
      },
    });

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("[ai/insights/dashboard]", error);
    return NextResponse.json(
      { success: false, message: "AI özeti yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function aiModuleInsightHandler(moduleKey: string) {
  try {
    const auth = await requireApiModuleAccess("ai-assistant");
    if ("error" in auth) return auth.error;

    const allowed = ["sales", "products", "cash-bank", "invoices", "customers"];
    if (!allowed.includes(moduleKey)) {
      return NextResponse.json(
        { success: false, message: "Modül özeti bulunamadı." },
        { status: 404 }
      );
    }

    const data = await generateModuleInsightCommentary({
      companyId: auth.companyId,
      userId: auth.userId,
      userName: auth.session.user.name,
      effectiveRole: auth.session.effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
      moduleKey,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ai/insights/module]", error);
    return NextResponse.json(
      { success: false, message: "Modül özeti yüklenemedi." },
      { status: 500 }
    );
  }
}
