import { db } from "@/lib/prisma";
import {
  buildInitialAssistantMessage,
  calculateRiskScore,
  formatAiMoney,
  formatDateDisplay,
  getRiskMeta,
  isInDateRange,
  type AiActionCard,
  type AiAssistantContext,
  type AiChatMessage,
  type AiInsightCard,
  type AiMetricCard,
  type AiRecommendation,
  type AiRiskRow,
  type AiSignalRow,
  type AiTopicKey,
} from "@/lib/ai-assistant-page-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { activeSaleStatusFilter, isActiveSaleStatus } from "@/lib/sale-query-utils";
import {
  buildCanonicalFinancialSummary,
} from "@/lib/finance/financial-summary-service";
import { FINANCIAL_METRIC_VERSION } from "@/lib/finance/financial-summary-service";
import {
  mapAccountTransactions,
  sumActiveAccountBalances,
} from "@/lib/finance-aggregation-utils";

export type {
  AiActionCard,
  AiAssistantContext,
  AiChatMessage,
  AiInsightCard,
  AiMetricCard,
  AiRecommendation,
  AiRiskRow,
  AiSignalRow,
  AiTopicKey,
} from "@/lib/ai-assistant-page-utils";

export {
  AI_TOPIC_LABELS,
  QUICK_QUESTIONS,
  buildAiAssistantQuery,
  formatAiMoney,
  formatAiNumber,
  formatDateDisplay,
  formatDateInputValue,
  generateAiAnswer,
  normalizeDateRange,
  parseAiTopic,
  parseDateParam,
  parseInitialQuestion,
  topicShowsCollection,
  topicShowsExpense,
  topicShowsFinance,
  topicShowsStock,
} from "@/lib/ai-assistant-page-utils";

const ACTION_CARDS: AiActionCard[] = [
  {
    title: "Finans Analizi",
    description: "Gelir, gider ve kâr yorumu",
    topic: "finance",
    iconKey: "brain",
    color: "emerald",
  },
  {
    title: "Tahsilat Önerileri",
    description: "Bekleyen ödemeleri analiz et",
    topic: "collection",
    iconKey: "wallet",
    color: "blue",
  },
  {
    title: "Stok Riskleri",
    description: "Kritik ürünleri kontrol et",
    topic: "stock",
    iconKey: "package",
    color: "orange",
  },
  {
    title: "Gider Yorumu",
    description: "Harcamaları sadeleştir",
    topic: "expense",
    iconKey: "receipt",
    color: "violet",
  },
  {
    title: "AI Sohbet",
    description: "İşletmene soru sor",
    topic: "chat",
    iconKey: "message",
    color: "rose",
  },
];

export async function getAiAssistantPageData(
  companyId: string,
  options: {
    from: Date;
    to: Date;
    userName: string;
  }
) {
  const [salesRaw, expensesRaw, invoicesRaw, productsRaw, customersRaw, accountsRaw, accountTransactionRows] =
    await Promise.all([
      db.sale.findMany({
        where: { companyId, ...activeSaleStatusFilter() },
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
      }),
      db.expense.findMany({
        where: { companyId },
        orderBy: { date: "desc" },
      }),
      db.invoice.findMany({
        where: { companyId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      }),
      db.product.findMany({
        where: { companyId },
        include: { saleItems: { include: { sale: true } } },
      }),
      db.customer.findMany({
        where: { companyId },
        include: { sales: true, invoices: true },
      }),
      db.account.findMany({
        where: { companyId },
      }),
      db.accountTransaction.findMany({
        where: { account: { companyId } },
        select: {
          id: true,
          date: true,
          createdAt: true,
          title: true,
          note: true,
          amount: true,
          type: true,
          expenseId: true,
        },
      }),
    ]);

  const accountTransactions = mapAccountTransactions(accountTransactionRows);

  const sales = salesRaw.filter((sale) =>
    isInDateRange(sale.createdAt, options.from, options.to)
  );
  const expenses = expensesRaw.filter((expense) =>
    isInDateRange(expense.date, options.from, options.to)
  );
  const invoices = invoicesRaw.filter((invoice) =>
    isInDateRange(invoice.createdAt, options.from, options.to)
  );

  const accrualSalesTotal = sales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0
  );
  const financeSummary = buildCanonicalFinancialSummary(
    accountTransactions,
    expensesRaw,
    options.from,
    options.to
  );
  const financeBreakdown = financeSummary.breakdown;
  /** Nakit gelir — Dashboard/Raporlarla aynı */
  const totalSales = financeSummary.revenue.total;
  const totalExpenses = financeSummary.expenses.cashTotal;
  const cashIncome = financeSummary.revenue.total;
  const profit = financeSummary.profit.operational;

  const accountBalance = sumActiveAccountBalances(accountsRaw);

  const unpaidInvoices = invoices.filter(
    (invoice) =>
      invoice.status !== "CANCELLED" &&
      invoice.paymentStatus !== "PAID" &&
      !invoice.saleId
  );
  const unpaidInvoiceTotal = unpaidInvoices.reduce(
    (sum, invoice) =>
      sum +
      getInvoiceRemainingAmount(Number(invoice.total), Number(invoice.paidAmount)),
    0
  );

  const lowStockProducts = productsRaw.filter(
    (product) => product.stock > 0 && product.stock <= 10
  );
  const outOfStockProducts = productsRaw.filter((product) => product.stock <= 0);

  const topProduct = productsRaw
    .map((product) => {
      const relevantItems = product.saleItems.filter(
        (item) =>
          isInDateRange(item.sale.createdAt, options.from, options.to) &&
          isActiveSaleStatus(item.sale.status)
      );
      const revenue = relevantItems.reduce(
        (sum, item) => sum + Number(item.total),
        0
      );
      const soldQty = relevantItems.reduce((sum, item) => sum + item.quantity, 0);

      return {
        name: product.name,
        revenue,
        soldQty,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)[0];

  const topCustomer = customersRaw
    .map((customer) => {
      const relevantSales = customer.sales.filter(
        (sale) =>
          isInDateRange(sale.createdAt, options.from, options.to) &&
          isActiveSaleStatus(sale.status)
      );
      const revenue = relevantSales.reduce(
        (sum, sale) => sum + Number(sale.total),
        0
      );

      return {
        name: customer.name,
        revenue,
        salesCount: relevantSales.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)[0];

  const expenseCategories = Array.from(
    expenses.reduce((map, expense) => {
      const key = expense.category || "Genel";
      map.set(key, (map.get(key) || 0) + Number(expense.amount));
      return map;
    }, new Map<string, number>())
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const highestExpenseCategory = expenseCategories[0];

  const riskScore = calculateRiskScore({
    profit,
    totalSales,
    unpaidInvoiceTotal,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    totalExpenses,
    accountBalance,
  });

  const riskMeta = getRiskMeta(riskScore);
  const userFirstName = options.userName.split(" ")[0] || "Merhaba";

  const context: AiAssistantContext = {
    userFirstName,
    totalSales,
    accrualSalesTotal,
    totalExpenses,
    profit,
    cashIncome,
    saleCollectionIncome: financeBreakdown.saleCollectionIncome,
    manualIncome: financeBreakdown.manualIncome,
    manualCashExpense: financeBreakdown.manualCashExpense,
    saleCancelExpense: financeBreakdown.saleCancelExpense,
    transferInTotal: financeBreakdown.transferInTotal,
    transferOutTotal: financeBreakdown.transferOutTotal,
    salesCount: sales.length,
    expensesCount: expenses.length,
    unpaidInvoiceTotal,
    unpaidInvoiceCount: unpaidInvoices.length,
    accountBalance,
    lowStockCount: lowStockProducts.length,
    outOfStockCount: outOfStockProducts.length,
    riskScore,
    riskLevel: riskMeta.level,
    topProductName: topProduct?.revenue ? topProduct.name : null,
    topProductRevenue: topProduct?.revenue ?? 0,
    topProductSoldQty: topProduct?.soldQty ?? 0,
    topCustomerName: topCustomer?.revenue ? topCustomer.name : null,
    topCustomerRevenue: topCustomer?.revenue ?? 0,
    topCustomerSalesCount: topCustomer?.salesCount ?? 0,
    topExpenseCategory: highestExpenseCategory?.category ?? null,
    topExpenseAmount: highestExpenseCategory?.amount ?? 0,
    periodLabel: `${formatDateDisplay(options.from)} - ${formatDateDisplay(options.to)}`,
    metricVersion: FINANCIAL_METRIC_VERSION,
  };

  const metricCards: AiMetricCard[] = [
    {
      title: "Nakit Gelir",
      value: formatAiMoney(cashIncome),
      description: `${formatAiMoney(financeBreakdown.saleCollectionIncome)} tahsilat · ${formatAiMoney(financeBreakdown.manualIncome)} manuel`,
      iconKey: "trendingUp",
      color: "emerald",
    },
    {
      title: "Nakit Gider",
      value: formatAiMoney(totalExpenses),
      description: "Ödenen gider + manuel çıkış",
      iconKey: "receipt",
      color: "rose",
    },
    {
      title: "Operasyonel Nakit Sonucu",
      value: formatAiMoney(profit),
      description: profit >= 0 ? "Nakit giriş − nakit çıkış" : "Nakit çıkış ağırlıklı",
      iconKey: "banknote",
      color: profit >= 0 ? "emerald" : "rose",
    },
    {
      title: "Kayıt Oluşturma Tarihine Göre Satış",
      value: formatAiMoney(accrualSalesTotal),
      description: `${sales.length} aktif satış · createdAt`,
      iconKey: "file",
      color: "blue",
    },
    {
      title: "Bekleyen Tahsilat",
      value: formatAiMoney(unpaidInvoiceTotal),
      description: `${unpaidInvoices.length} fatura`,
      iconKey: "file",
      color: "orange",
    },
    {
      title: "AI Risk Skoru",
      value: `${riskScore}/100`,
      description: riskMeta.level,
      iconKey: "brain",
      color: "violet",
    },
  ];

  const insights: AiInsightCard[] = [
    {
      title:
        profit >= 0 ? "İşletmeniz kârda görünüyor" : "Giderler satışları geçmiş",
      description:
        profit >= 0
          ? `Satışlarınız giderlerinizi ${formatAiMoney(Math.abs(profit))} kadar aşmış görünüyor.`
          : `Bu dönemde giderler satışlarınızı ${formatAiMoney(Math.abs(profit))} kadar geçmiş görünüyor.`,
      iconKey: profit >= 0 ? "trendingUp" : "trendingDown",
      color:
        profit >= 0
          ? "bg-emerald-50 text-emerald-600"
          : "bg-rose-50 text-rose-500",
      badge:
        profit >= 0
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700",
    },
    {
      title: "Bekleyen tahsilatları takip edin",
      description:
        unpaidInvoiceTotal > 0
          ? `${unpaidInvoices.length} faturada toplam ${formatAiMoney(unpaidInvoiceTotal)} tahsilat bekliyor.`
          : "Bekleyen tahsilat görünmüyor. Nakit akışı daha sağlıklı.",
      iconKey: "wallet",
      color: "bg-orange-50 text-orange-500",
      badge: "bg-orange-100 text-orange-700",
    },
    {
      title: "Stok durumunu kontrol edin",
      description:
        lowStockProducts.length > 0 || outOfStockProducts.length > 0
          ? `${lowStockProducts.length} ürün düşük stokta, ${outOfStockProducts.length} ürün stokta yok.`
          : "Kritik seviyede görünen ürün bulunmuyor.",
      iconKey: "package",
      color: "bg-blue-50 text-blue-600",
      badge: "bg-blue-100 text-blue-700",
    },
  ];

  const recommendations: AiRecommendation[] = [
    {
      title: "Tahsilat hatırlatmaları oluşturun",
      description:
        "Ödenmemiş faturalar için müşterilere düzenli hatırlatma yapılması nakit akışını güçlendirir.",
      priority: "Öncelikli",
      color: "bg-rose-50 text-rose-600",
    },
    {
      title: "Düşük stoklu ürünleri yenileyin",
      description:
        "Stokta azalan ürünler satış kaybı yaşatabilir. Kritik ürünler için stok girişi planlanmalıdır.",
      priority: "Orta",
      color: "bg-orange-50 text-orange-600",
    },
    {
      title: "Gider kategorilerini izleyin",
      description: highestExpenseCategory
        ? `En yüksek gider kategoriniz ${highestExpenseCategory.category}. Bu kalemi detaylı incelemek faydalı olur.`
        : "Gider kategorisi verisi oluştuğunda burada analiz gösterilir.",
      priority: "Analiz",
      color: "bg-blue-50 text-blue-600",
    },
  ];

  const riskRows: AiRiskRow[] = [
    {
      title: "Kârlılık",
      status: profit >= 0 ? "İyi" : "Riskli",
      danger: profit < 0,
      description:
        profit >= 0
          ? "Satışlar giderleri karşılıyor."
          : "Giderler satışların üzerinde.",
    },
    {
      title: "Tahsilat",
      status: unpaidInvoiceTotal > 0 ? "Takip gerekli" : "İyi",
      danger: unpaidInvoiceTotal > 0,
      description:
        unpaidInvoiceTotal > 0
          ? `${formatAiMoney(unpaidInvoiceTotal)} tahsilat bekliyor.`
          : "Bekleyen tahsilat görünmüyor.",
    },
    {
      title: "Stok",
      status:
        lowStockProducts.length > 0 || outOfStockProducts.length > 0
          ? "Kontrol gerekli"
          : "İyi",
      danger: lowStockProducts.length > 0 || outOfStockProducts.length > 0,
      description:
        lowStockProducts.length > 0 || outOfStockProducts.length > 0
          ? "Bazı ürünlerde stok riski var."
          : "Kritik stok uyarısı yok.",
    },
    {
      title: "Nakit",
      status: accountBalance > 0 ? "Aktif" : "Düşük",
      danger: accountBalance <= 0,
      description: `Kasa & banka toplamı ${formatAiMoney(accountBalance)}.`,
    },
  ];

  const signals: AiSignalRow[] = [
    {
      label: "Kârlılık",
      value: profit >= 0 ? "Pozitif" : "Negatif",
      iconKey: "trendingUp",
      color: profit >= 0 ? "emerald" : "rose",
    },
    {
      label: "Tahsilat",
      value: `${unpaidInvoices.length} bekleyen`,
      iconKey: "wallet",
      color: unpaidInvoices.length > 0 ? "orange" : "emerald",
    },
    {
      label: "Stok Riski",
      value: `${lowStockProducts.length + outOfStockProducts.length} ürün`,
      iconKey: "package",
      color:
        lowStockProducts.length + outOfStockProducts.length > 0
          ? "rose"
          : "emerald",
    },
    {
      label: "Nakit",
      value: formatAiMoney(accountBalance),
      iconKey: "banknote",
      color: "blue",
    },
  ];

  const initialMessages: AiChatMessage[] = [
    {
      id: "assistant-welcome",
      role: "assistant",
      content: buildInitialAssistantMessage(context),
    },
  ];

  return {
    actionCards: ACTION_CARDS,
    metricCards,
    insights,
    recommendations,
    riskRows,
    signals,
    context,
    riskMeta,
    initialMessages,
    financeSummary:
      profit >= 0
        ? `Bu dönemde nakit geliriniz nakit giderinizi karşılıyor. Operasyonel nakit sonucu ${formatAiMoney(profit)}. Bekleyen tahsilatlar düzenli takip edilirse nakit akışı daha sağlıklı ilerler.`
        : `Bu dönemde nakit gideriniz nakit gelirinizin üzerinde. Operasyonel nakit sonucu ${formatAiMoney(profit)}. Gider kategorilerini ve bekleyen tahsilatları incelemeniz önerilir.`,
    financeHeadline:
      profit >= 0
        ? "Genel tablo olumlu görünüyor."
        : "Gider tarafı dikkat gerektiriyor.",
    topHighlights: {
      productName: topProduct?.revenue ? topProduct.name : "Veri yok",
      productSub: topProduct?.revenue
        ? `${topProduct.soldQty} satış · ${formatAiMoney(topProduct.revenue)}`
        : "Satış verisi oluşmadı",
      customerName: topCustomer?.revenue ? topCustomer.name : "Veri yok",
      customerSub: topCustomer?.revenue
        ? `${topCustomer.salesCount} satış · ${formatAiMoney(topCustomer.revenue)}`
        : "Müşteri satışı oluşmadı",
      expenseCategory: highestExpenseCategory?.category ?? "Veri yok",
      expenseSub: highestExpenseCategory
        ? formatAiMoney(highestExpenseCategory.amount)
        : "Gider verisi oluşmadı",
    },
  };
}
