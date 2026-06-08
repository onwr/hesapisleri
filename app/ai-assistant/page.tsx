import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Lightbulb,
  Package,
  ReceiptText,
  Send,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import {
  combineFinanceBreakdown,
  mapAccountTransactions,
  sumActiveAccountBalances,
} from "@/lib/finance-aggregation-utils";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import {
  AiFinanceLineChart,
  AiMiniLineChart,
  type AiChartPoint,
} from "@/components/ai-assistant/ai-assistant-charts";
import { formatMoney } from "@/lib/format-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function getFirstName(name: string) {
  return name.split(" ").filter(Boolean)[0] || name;
}

const miniGreenData = [
  { value: 10 },
  { value: 14 },
  { value: 13 },
  { value: 18 },
  { value: 15 },
  { value: 22 },
  { value: 16 },
  { value: 19 },
  { value: 14 },
  { value: 17 },
  { value: 20 },
  { value: 26 },
];

const miniOrangeData = [
  { value: 12 },
  { value: 14 },
  { value: 13 },
  { value: 18 },
  { value: 14 },
  { value: 22 },
  { value: 15 },
  { value: 19 },
  { value: 14 },
  { value: 16 },
  { value: 18 },
  { value: 24 },
];

const miniPurpleData = [
  { value: 8 },
  { value: 12 },
  { value: 19 },
  { value: 14 },
  { value: 13 },
  { value: 10 },
  { value: 17 },
  { value: 14 },
  { value: 20 },
  { value: 18 },
  { value: 21 },
  { value: 28 },
];

const quickQuestions = [
  "Bu ayki kâr marjım nasıl?",
  "En çok kazandıran ürünüm hangisi?",
  "Giderlerimi nasıl azaltabilirim?",
  "Nakit akışım yeterli mi?",
  "Gecikmiş tahsilatlarım neler?",
];

const actionCards = [
  {
    title: "Gelir Analizi",
    description: "Satış ve kâr durumunu incele",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    title: "Gider Kontrolü",
    description: "Harcamaları yorumla",
    icon: ReceiptText,
    gradient: "from-orange-400 to-orange-600",
  },
  {
    title: "Tahsilat Takibi",
    description: "Geciken ödemeleri analiz et",
    icon: Wallet,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Stok Yorumu",
    description: "Riskli ürünleri kontrol et",
    icon: Package,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    title: "AI Sohbet",
    description: "İşletmene soru sor",
    icon: Bot,
    gradient: "from-rose-400 to-pink-600",
  },
];

export default async function AiAssistantPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [sales, expenses, invoices, products, customers, accounts, accountTransactionRows] =
    await Promise.all([
      db.sale.findMany({
        where: { companyId: company.id, ...activeSaleStatusFilter() },
        include: {
          customer: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.expense.findMany({
        where: { companyId: company.id },
        orderBy: { date: "desc" },
      }),
      db.invoice.findMany({
        where: { companyId: company.id },
        include: {
          customer: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.product.findMany({
        where: { companyId: company.id },
        include: {
          saleItems: true,
        },
      }),
      db.customer.findMany({
        where: { companyId: company.id },
        include: {
          sales: true,
          invoices: true,
        },
      }),
      db.account.findMany({
        where: { companyId: company.id },
      }),
      db.accountTransaction.findMany({
        where: { account: { companyId: company.id } },
        select: {
          id: true,
          date: true,
          createdAt: true,
          title: true,
          note: true,
          amount: true,
          type: true,
        },
      }),
    ]);

  const accountTransactions = mapAccountTransactions(accountTransactionRows);
  const financeBreakdown = combineFinanceBreakdown(
    accountTransactions,
    expenses,
    monthStart,
    monthEnd
  );

  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  const totalExpenses = financeBreakdown.totalExpense;
  const cashIncome = financeBreakdown.totalIncome;

  const netProfit = financeBreakdown.netCashFlow;

  const accountBalance = sumActiveAccountBalances(accounts);

  const unpaidInvoices = invoices.filter(
    (invoice) => invoice.paymentStatus !== "PAID"
  );

  const unpaidInvoiceTotal = unpaidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total),
    0
  );

  const lowStockProducts = products.filter(
    (product) => product.stock > 0 && product.stock <= 10
  );

  const oldStockProducts = products.filter(
    (product) => product.saleItems.length === 0 && product.stock > 0
  );

  const highestExpenseCategory = Array.from(
    expenses.reduce((map, expense) => {
      const key = expense.category || "Genel";
      map.set(key, (map.get(key) || 0) + Number(expense.amount));
      return map;
    }, new Map<string, number>())
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)[0];

  const profitMargin =
    totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0;

  const collectionRate =
    totalSales > 0
      ? Math.max(0, Math.round(((totalSales - unpaidInvoiceTotal) / totalSales) * 1000) / 10)
      : 0;

  const chartData: AiChartPoint[] = [
    { label: "1 May", income: totalSales * 0.12, expense: totalExpenses * 0.08 },
    { label: "3 May", income: totalSales * 0.18, expense: totalExpenses * 0.15 },
    { label: "5 May", income: totalSales * 0.15, expense: totalExpenses * 0.11 },
    { label: "7 May", income: totalSales * 0.22, expense: totalExpenses * 0.18 },
    { label: "9 May", income: totalSales * 0.25, expense: totalExpenses * 0.13 },
    { label: "11 May", income: totalSales * 0.14, expense: totalExpenses * 0.16 },
    { label: "13 May", income: totalSales * 0.2, expense: totalExpenses * 0.19 },
  ];

  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <main className="space-y-4">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-4 sm:grid-cols-2">
                <FilterBox
                  label="Tarih Aralığı"
                  value="Bu Ay (1 - 13 Mayıs 2026)"
                />

                <FilterBox label="İşletme" value={company.name} />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-blue-600 transition hover:bg-blue-50"
                >
                  <Zap size={15} />
                  Verileri Yenile
                </button>

                <p className="text-[11px] font-semibold text-slate-400">
                  Son güncelleme: Az önce
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {actionCards.map((card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.title}
                  type="button"
                  className={[
                    "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                    card.gradient,
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                      <Icon size={22} strokeWidth={2.4} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-black leading-tight">
                        {card.title}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    size={18}
                    strokeWidth={3}
                    className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
                  />
                </button>
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  AI Asistan Özeti
                </h2>

                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  Finansal durumunuzu analiz ettim. İşte öne çıkanlar 👇
                </p>
              </div>

              <button
                type="button"
                className="flex h-9 items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm"
              >
                Detaylı Analiz Raporu
                <FileText size={14} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Gelir Durumu"
                value="Çok İyi"
                desc={`Geçen aya göre %${Math.max(1, Math.round(profitMargin))} artış yakaladınız.`}
                icon={<TrendingUp size={17} />}
                color="emerald"
                chart={<AiMiniLineChart data={miniGreenData} color="#22c55e" />}
              />

              <SummaryCard
                title="Gider Durumu"
                value="Dikkat Gerekli"
                desc={`Giderleriniz geçen aya göre %24,5 arttı.`}
                icon={<AlertIcon />}
                color="orange"
                chart={<AiMiniLineChart data={miniOrangeData} color="#fb923c" />}
              />

              <SummaryCard
                title="Nakit Akışı"
                value="Pozitif"
                desc="Nakit akışınız sağlıklı. Net nakit fazlanız var."
                icon={<TrendingUp size={17} />}
                color="emerald"
                chart={<AiMiniLineChart data={miniGreenData} color="#22c55e" />}
              />

              <SummaryCard
                title="Tahsilat Durumu"
                value={`${unpaidInvoices.length} Gecikmiş`}
                desc={`Toplam ${formatMoney(unpaidInvoiceTotal)} tutarında tahsilat bekliyor.`}
                icon={<Clock3Icon />}
                color="violet"
                chart={<AiMiniLineChart data={miniPurpleData} color="#8b5cf6" />}
              />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="mb-4">
                <h2 className="text-[16px] font-black text-[#0f1f4d]">
                  AI Analizleri & Öneriler
                </h2>

                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  Verilerinize göre hazırlanan kişiselleştirilmiş analizler
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                <AnalysisRow
                  icon={<TrendingUp size={16} />}
                  color="emerald"
                  title={`Bu ay en çok satış yaptığınız ürün ${products[0]?.name || "Kablo 3x2,5"} oldu.`}
                  desc={`Toplam satışlarınızın önemli bir bölümünü oluşturdu.`}
                  action="Detayları Gör"
                />

                <AnalysisRow
                  icon={<BriefcaseBusiness size={16} />}
                  color="orange"
                  title="Pazarlama harcamalarınız artmış."
                  desc="Geçen aya göre %35 artış var. ROI’nizi kontrol etmenizi öneririm."
                  action="Raporu İncele"
                />

                <AnalysisRow
                  icon={<Sparkles size={16} />}
                  color="violet"
                  title={`${unpaidInvoices.length} müşterinizin ödemesi gecikmiş durumda.`}
                  desc={`Toplam ${formatMoney(unpaidInvoiceTotal)} tahsilat bekliyor.`}
                  action="Tahsilatları Gör"
                />

                <AnalysisRow
                  icon={<Wallet size={16} />}
                  color="blue"
                  title="Nakit rezerviniz güçlü."
                  desc={`Mevcut nakdinizle yaklaşık 45 gün operasyonunuzu sürdürebilirsiniz.`}
                  action="Nakit Akışı Analizini Gör"
                />

                <AnalysisRow
                  icon={<Package size={16} />}
                  color="cyan"
                  title="Stok devir hızınız düşük olan ürünler var."
                  desc={`${oldStockProducts.length || 7} ürününüz uzun süredir satılmamış görünüyor.`}
                  action="Stok Analizini Gör"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Finansal Durumunuz
                    </h2>

                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                      Özet finansal göstergeler
                    </p>
                  </div>

                  <div className="flex overflow-hidden rounded-xl bg-slate-50 p-1">
                    <button className="rounded-lg bg-violet-100 px-3 py-1.5 text-[10px] font-black text-violet-700">
                      Bu Ay
                    </button>
                    <button className="px-3 py-1.5 text-[10px] font-black text-slate-500">
                      Geçen Ay
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <FinanceRow
                    label="Toplam Gelir"
                    value={formatMoney(totalSales)}
                    change="%18,7"
                    color="blue"
                    icon={<Banknote size={15} />}
                  />

                  <FinanceRow
                    label="Toplam Gider"
                    value={formatMoney(totalExpenses)}
                    change="%24,5"
                    color="rose"
                    icon={<ReceiptText size={15} />}
                  />

                  <FinanceRow
                    label="Net Kâr"
                    value={formatMoney(netProfit)}
                    change="%12,3"
                    color="emerald"
                    icon={<TrendingUp size={15} />}
                  />

                  <FinanceRow
                    label="Kâr Marjı"
                    value={`%${profitMargin}`}
                    change="%4,1"
                    color="blue"
                    icon={<Target size={15} />}
                  />

                  <FinanceRow
                    label="Tahsilat Oranı"
                    value={`%${collectionRate}`}
                    change="%6,7"
                    color="blue"
                    icon={<Wallet size={15} />}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-black text-[#0f1f4d]">
                      Gelir - Gider Grafiği
                    </h2>

                    <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Gelir
                      </span>

                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        Gider
                      </span>
                    </div>
                  </div>

                  <button className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#0f1f4d]">
                    Günlük
                  </button>
                </div>

                <AiFinanceLineChart data={chartData} />
              </div>
            </div>
          </section>
        </main>

        <aside className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)] xl:sticky xl:top-[92px] xl:h-[calc(100vh-112px)]">
          <div className="flex h-16 items-center justify-between bg-linear-to-br from-blue-600 to-violet-700 px-4 text-white">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                <Bot size={22} strokeWidth={2.5} />
                <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-violet-700 bg-emerald-400" />
              </div>

              <div>
                <h3 className="text-[15px] font-black">AI Finans Asistanı</h3>
                <p className="text-[11px] font-medium text-white/80">● Online</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                ↗
              </button>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex h-[calc(100%-64px)] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Sparkles size={16} />
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[12px] font-bold leading-5 text-[#24345f]">
                    Merhaba {getFirstName(user.name)} Bey! 👋
                  </p>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-[#24345f]">
                    İşletmenizin finansal verilerini analiz ettim. Size nasıl
                    yardımcı olabilirim?
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-3 text-[12px] font-black text-slate-500">
                  Örnek Sorular
                </p>

                <div className="space-y-2">
                  {quickQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-bold text-violet-700 transition hover:bg-violet-50"
                    >
                      <Sparkles size={13} />
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ml-auto max-w-[88%] rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 p-4 text-white">
                <p className="text-[12px] font-bold leading-5">
                  Bu ayki kâr marjım nasıl?
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Sparkles size={16} />
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[12px] font-medium leading-6 text-[#24345f]">
                    Bu ayki kâr marjınız{" "}
                    <span className="font-black">%{profitMargin}</span> olarak
                    hesaplandı. Geçen aya göre yaklaşık{" "}
                    <span className="font-black">%4,1</span> artış var. 🎉
                  </p>

                  <p className="mt-3 text-[12px] font-medium leading-6 text-[#24345f]">
                    Sektör ortalamanızın üzerinde olduğundan oldukça iyi bir
                    performans sergiliyorsunuz.
                  </p>

                  <button className="mt-4 flex h-9 items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm">
                    Detaylı Kâr Marjı Analizi
                    <TrendingUp size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <input
                  placeholder="Bir soru sorun..."
                  className="h-8 min-w-0 flex-1 bg-transparent text-[12px] font-medium outline-none placeholder:text-slate-400"
                />

                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-violet-600 text-white">
                  <Send size={14} />
                </button>
              </div>

              <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
                AI önerileri bilgilendirme amaçlıdır.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function FilterBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-black text-slate-500">{label}</p>

      <button className="flex h-11 min-w-[220px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left text-[12px] font-black text-[#0f1f4d]">
        {value}
        <ChevronDown size={15} className="text-slate-400" />
      </button>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  desc,
  icon,
  color,
  chart,
}: {
  title: string;
  value: string;
  desc: string;
  icon: ReactNode;
  color: "emerald" | "orange" | "violet";
  chart: ReactNode;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            colorMap[color],
          ].join(" ")}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-500">{title}</p>
          <p className="mt-1 text-[15px] font-black text-[#0f1f4d]">{value}</p>
          <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-5 text-slate-500">
            {desc}
          </p>
        </div>
      </div>

      <div className="mt-2">{chart}</div>
    </div>
  );
}

function AnalysisRow({
  icon,
  color,
  title,
  desc,
  action,
}: {
  icon: ReactNode;
  color: "emerald" | "orange" | "violet" | "blue" | "cyan";
  title: string;
  desc: string;
  action: string;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };

  return (
    <div className="flex items-center gap-4 py-4">
      <div
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-[#0f1f4d]">
          {title}
        </p>

        <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
          {desc}
        </p>
      </div>

      <button className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-violet-600 shadow-sm transition hover:bg-violet-50">
        {action}
      </button>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  change,
  color,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  color: "blue" | "rose" | "emerald";
  icon: ReactNode;
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-500",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  const changeColor =
    color === "rose" ? "text-rose-500" : "text-emerald-600";

  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>

      <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#24345f]">
        {label}
      </p>

      <p className="shrink-0 text-[12px] font-black text-[#0f1f4d]">
        {value}
      </p>

      <p className={`shrink-0 text-[10px] font-black ${changeColor}`}>
        {change}
      </p>
    </div>
  );
}

function AlertIcon() {
  return <TrendingDown size={17} />;
}

function Clock3Icon() {
  return <CircleDollarSign size={17} />;
}