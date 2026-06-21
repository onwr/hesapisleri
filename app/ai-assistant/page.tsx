import { redirect } from "next/navigation";
import {
  Banknote,
  Brain,
  FileText,
  Lightbulb,
  Package,
  ReceiptText,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  AiAssistantActionCards,
  AiAssistantPageControls,
} from "@/components/ai-assistant/ai-assistant-page-controls";
import { AiAssistantChatPanel } from "@/components/ai-assistant/ai-assistant-chat-panel";
import { AiAssistantSidebar } from "@/components/ai-assistant/ai-assistant-sidebar";
import { AiAssistantTopicFocus } from "@/components/ai-assistant/ai-assistant-topic-focus";
import { AiRiskMeter } from "@/components/ai-assistant/ai-risk-meter";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { db } from "@/lib/prisma";
import { getAiAssistantPageData } from "@/lib/ai-assistant-page-data";
import {
  normalizeDateRange,
  parseAiTopic,
  parseDateParam,
  parseInitialQuestion,
  topicShowsCollection,
  topicShowsExpense,
  topicShowsFinance,
  topicShowsStock,
} from "@/lib/ai-assistant-page-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type AiAssistantPageProps = {
  searchParams: Promise<{
    topic?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

const metricIconMap = {
  trendingUp: TrendingUp,
  receipt: ReceiptText,
  banknote: Banknote,
  file: FileText,
  brain: Brain,
};

const metricColorMap = {
  emerald: "from-emerald-50 to-white text-emerald-600",
  rose: "from-rose-50 to-white text-rose-500",
  orange: "from-orange-50 to-white text-orange-500",
  blue: "from-blue-50 to-white text-blue-600",
  violet: "from-violet-50 to-white text-violet-600",
};

const insightIconMap = {
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  wallet: Wallet,
  package: Package,
};

export default async function AiAssistantPage({ searchParams }: AiAssistantPageProps) {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user) redirect("/login");

  const params = await searchParams;
  const activeTopic = parseAiTopic(params.topic);
  const now = new Date();
  const from = parseDateParam(params.from) || startOfMonth(now);
  const to = parseDateParam(params.to) || endOfMonth(now);
  const { from: rangeFrom, to: rangeTo } = normalizeDateRange(from, to);
  const initialQuestion = parseInitialQuestion(params.q);

  const data = await getAiAssistantPageData(payload.companyId, {
    from: rangeFrom,
    to: rangeTo,
    userName: user.name,
  });

  const showFinance = topicShowsFinance(activeTopic);
  const showCollection = topicShowsCollection(activeTopic);
  const showStock = topicShowsStock(activeTopic);
  const showExpense = topicShowsExpense(activeTopic);
  const showChat = activeTopic === "chat" || activeTopic === "all";

  return (
    <AppShell>
      <AiAssistantTopicFocus activeTopic={activeTopic} />

      <div className="space-y-5">
        <section className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 via-white to-blue-50 p-5 duration-500">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-violet-600">
                <Sparkles size={14} />
                AI Asistan
              </p>
              <h2 className="mt-1 text-[22px] font-black text-[#0f1f4d]">
                Merhaba {data.context.userFirstName}
              </h2>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                {data.financeHeadline} {data.context.periodLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500">Risk durumu</p>
              <p className={`text-[14px] font-black ${data.riskMeta.color}`}>
                {data.context.riskLevel}
              </p>
            </div>
          </div>
        </section>

        <AiAssistantPageControls
          activeTopic={activeTopic}
          from={rangeFrom}
          to={rangeTo}
        />

        <AiAssistantActionCards
          cards={data.actionCards}
          from={rangeFrom}
          to={rangeTo}
          activeTopic={activeTopic}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.metricCards.map((card, index) => {
            const Icon = metricIconMap[card.iconKey];
            return (
              <div
                key={card.title}
                className={[
                  "animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-linear-to-br p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500",
                  metricColorMap[card.color],
                ].join(" ")}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-extrabold text-slate-500">
                    {card.title}
                  </p>
                  <Icon size={16} />
                </div>
                <p className="mt-2 text-[20px] font-black text-[#0f1f4d]">
                  {card.value}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  {card.description}
                </p>
              </div>
            );
          })}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {(showFinance || showCollection || showStock || showExpense) && (
              <section className="grid gap-4 lg:grid-cols-2">
                {data.insights
                  .filter((insight) => {
                    if (activeTopic === "all") return true;
                    if (activeTopic === "finance") {
                      return (
                        insight.iconKey === "trendingUp" ||
                        insight.iconKey === "trendingDown"
                      );
                    }
                    if (activeTopic === "collection") {
                      return insight.iconKey === "wallet";
                    }
                    if (activeTopic === "stock") {
                      return insight.iconKey === "package";
                    }
                    if (activeTopic === "expense") {
                      return (
                        insight.iconKey === "trendingDown" ||
                        insight.iconKey === "trendingUp"
                      );
                    }
                    return true;
                  })
                  .map((insight, index) => {
                    const Icon = insightIconMap[insight.iconKey];
                    return (
                      <article
                        key={insight.title}
                        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
                        style={{ animationDelay: `${index * 70}ms` }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={[
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                              insight.color,
                            ].join(" ")}
                          >
                            <Icon size={18} />
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-600">
                            {insight.badge}
                          </span>
                        </div>
                        <h3 className="mt-3 text-[14px] font-black text-[#0f1f4d]">
                          {insight.title}
                        </h3>
                        <p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">
                          {insight.description}
                        </p>
                      </article>
                    );
                  })}
              </section>
            )}

            {showChat ? (
              <AiAssistantChatPanel
                initialMessages={data.initialMessages}
                initialQuestion={initialQuestion}
                highlight={activeTopic === "chat"}
                from={rangeFrom}
                to={rangeTo}
                activeTopic={activeTopic}
              />
            ) : null}

            {showFinance && (
              <section className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-700">
                <div className="mb-3 flex items-center gap-2">
                  <Target size={16} className="text-blue-600" />
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    Öneriler
                  </h3>
                </div>
                <div className="space-y-3">
                  {data.recommendations.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-black text-[#0f1f4d]">
                          {item.title}
                        </p>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                            item.color,
                          ].join(" ")}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="animate-in fade-in slide-in-from-right-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-700">
              <div className="mb-1 flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500" />
                <h3 className="text-[15px] font-black text-[#0f1f4d]">
                  Risk Analizi
                </h3>
              </div>
              <AiRiskMeter
                score={data.context.riskScore}
                barClass={data.riskMeta.bar}
                textClass={data.riskMeta.color}
              />
              <div className="space-y-2">
                {data.riskRows.map((row) => (
                  <div
                    key={row.title}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-bold text-[#24345f]">
                        {row.title}
                      </p>
                      <span
                        className={[
                          "text-[10px] font-extrabold",
                          row.danger ? "text-rose-500" : "text-emerald-600",
                        ].join(" ")}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      {row.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <AiAssistantSidebar signals={data.signals} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
