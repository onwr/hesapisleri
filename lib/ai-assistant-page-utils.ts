import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";
import { startOfDay } from "@/lib/dashboard-metrics";

export type AiTopicKey =
  | "all"
  | "finance"
  | "collection"
  | "stock"
  | "expense"
  | "chat";

export type AiMetricCard = {
  title: string;
  value: string;
  description: string;
  iconKey: "trendingUp" | "receipt" | "banknote" | "file" | "brain";
  color: "emerald" | "rose" | "orange" | "blue" | "violet";
};

export type AiInsightCard = {
  title: string;
  description: string;
  iconKey: "trendingUp" | "trendingDown" | "wallet" | "package";
  color: string;
  badge: string;
};

export type AiRecommendation = {
  title: string;
  description: string;
  priority: string;
  color: string;
};

export type AiRiskRow = {
  title: string;
  status: string;
  description: string;
  danger: boolean;
};

export type AiSignalRow = {
  label: string;
  value: string;
  iconKey: "trendingUp" | "wallet" | "package" | "banknote";
  color: "emerald" | "rose" | "orange" | "blue";
};

export type AiActionCard = {
  title: string;
  description: string;
  topic: AiTopicKey;
  iconKey: "brain" | "wallet" | "package" | "receipt" | "message";
  color: "emerald" | "blue" | "orange" | "violet" | "rose";
};

export type AiChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  structured?: unknown;
};

export type AiAssistantContext = {
  userFirstName: string;
  totalSales: number;
  totalExpenses: number;
  profit: number;
  cashIncome: number;
  saleCollectionIncome: number;
  manualIncome: number;
  manualCashExpense: number;
  saleCancelExpense: number;
  transferInTotal: number;
  transferOutTotal: number;
  salesCount: number;
  expensesCount: number;
  unpaidInvoiceTotal: number;
  unpaidInvoiceCount: number;
  accountBalance: number;
  lowStockCount: number;
  outOfStockCount: number;
  riskScore: number;
  riskLevel: string;
  topProductName: string | null;
  topProductRevenue: number;
  topProductSoldQty: number;
  topCustomerName: string | null;
  topCustomerRevenue: number;
  topCustomerSalesCount: number;
  topExpenseCategory: string | null;
  topExpenseAmount: number;
  periodLabel: string;
};

export const AI_TOPIC_LABELS: Record<AiTopicKey, string> = {
  all: "Tüm Analizler",
  finance: "Finans Analizi",
  collection: "Tahsilat Önerileri",
  stock: "Stok Riskleri",
  expense: "Gider Yorumu",
  chat: "AI Sohbet",
};

export const QUICK_QUESTIONS = [
  "Bu ay kârda mıyım?",
  "En çok hangi üründen kazanıyorum?",
  "Hangi müşteriler ödeme geciktirdi?",
  "Stokta riskli ürün var mı?",
  "Giderlerim neden arttı?",
  "Nakit akışım sağlıklı mı?",
];

export function parseAiTopic(value?: string | null): AiTopicKey {
  if (
    value === "finance" ||
    value === "collection" ||
    value === "stock" ||
    value === "expense" ||
    value === "chat"
  ) {
    return value;
  }

  return "all";
}

export function parseInitialQuestion(value?: string | null) {
  if (!value) return null;
  const trimmed = decodeURIComponent(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

import {
  formatMoney as formatAiMoney,
  formatNumber as formatAiNumber,
} from "@/lib/format-utils";

export { formatAiMoney, formatAiNumber };

export function isInDateRange(date: Date, from: Date, to: Date) {
  const value = date.getTime();
  return value >= startOfDay(from).getTime() && value <= endOfDay(to).getTime();
}

export function calculateRiskScore(input: {
  profit: number;
  totalSales: number;
  unpaidInvoiceTotal: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalExpenses: number;
  accountBalance: number;
}) {
  let score = 18;

  if (input.profit < 0) score += 30;
  if (input.totalSales > 0 && input.unpaidInvoiceTotal > input.totalSales * 0.3) {
    score += 18;
  }
  if (input.lowStockCount > 0) score += 10;
  if (input.outOfStockCount > 0) score += 14;
  if (input.totalExpenses > 0 && input.accountBalance < input.totalExpenses * 0.5) {
    score += 15;
  }

  return Math.min(score, 100);
}

export function getRiskMeta(score: number) {
  if (score >= 70) {
    return {
      level: "Yüksek Risk",
      color: "text-rose-500",
      badge: "bg-rose-100 text-rose-700",
      bar: "bg-rose-500",
    };
  }

  if (score >= 40) {
    return {
      level: "Orta Risk",
      color: "text-orange-500",
      badge: "bg-orange-100 text-orange-700",
      bar: "bg-orange-500",
    };
  }

  return {
    level: "Düşük Risk",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
  };
}

export function generateAiAnswer(question: string, context: AiAssistantContext) {
  const q = question.toLocaleLowerCase("tr-TR");

  if (q.includes("kâr") || q.includes("kar") || q.includes("zarar")) {
    return context.profit >= 0
      ? `Seçili dönemde nakit akışınız ${formatAiMoney(context.profit)}. Kasa girişleri ${formatAiMoney(context.cashIncome)} (${formatAiMoney(context.saleCollectionIncome)} tahsilat, ${formatAiMoney(context.manualIncome)} manuel), toplam gider ${formatAiMoney(context.totalExpenses)}.`
      : `Seçili dönemde nakit akışınız ${formatAiMoney(context.profit)}. Giderler nakit girişlerini ${formatAiMoney(Math.abs(context.profit))} aşıyor. Gider kategorilerini ve tahsilatları gözden geçirmenizi öneririm.`;
  }

  if (q.includes("ürün") || q.includes("kazanıyorum") || q.includes("ciro")) {
    return context.topProductName
      ? `En çok ciro getiren ürününüz ${context.topProductName}. ${context.topProductSoldQty} adet satışla ${formatAiMoney(context.topProductRevenue)} ciro üretmiş.`
      : "Henüz yeterli satış verisi yok. Birkaç satış kaydı oluştuğunda en iyi ürün analizi burada görünecek.";
  }

  if (q.includes("müşteri") || q.includes("ödeme") || q.includes("gecik")) {
    return context.unpaidInvoiceCount > 0
      ? `${context.unpaidInvoiceCount} faturada toplam ${formatAiMoney(context.unpaidInvoiceTotal)} tahsilat bekliyor. En iyi müşteriniz ${context.topCustomerName ?? "henüz belirlenmedi"}; tahsilat takibi nakit akışını güçlendirir.`
      : "Bekleyen tahsilat görünmüyor. Nakit akışınız bu açıdan daha sağlıklı görünüyor.";
  }

  if (q.includes("stok") || q.includes("risk")) {
    return context.lowStockCount > 0 || context.outOfStockCount > 0
      ? `${context.lowStockCount} ürün düşük stokta, ${context.outOfStockCount} ürün stokta yok. Kritik ürünler için stok girişi planlamanız satış kaybını önler.`
      : "Kritik seviyede stok riski görünmüyor. Mevcut stok seviyeleriniz yeterli görünüyor.";
  }

  if (q.includes("gider") || q.includes("harcama")) {
    return context.topExpenseCategory
      ? `En yüksek gider kategoriniz ${context.topExpenseCategory} (${formatAiMoney(context.topExpenseAmount)}). Toplam gideriniz ${formatAiMoney(context.totalExpenses)}; bu kalemi detaylı incelemek faydalı olabilir.`
      : `Toplam gideriniz ${formatAiMoney(context.totalExpenses)}. Gider kategorileri oluştukça daha detaylı yorum yapabilirim.`;
  }

  if (q.includes("transfer")) {
    return `Transfer hareketleri işletme geliri sayılmaz. Bu dönemde ${formatAiMoney(context.transferOutTotal)} transfer çıkışı ve ${formatAiMoney(context.transferInTotal)} transfer girişi kaydı var. Kasa/banka toplam bakiyeniz ${formatAiMoney(context.accountBalance)}.`;
  }

  if (q.includes("nakit") || q.includes("kasa") || q.includes("banka")) {
    return `Kasa ve banka toplam bakiyeniz ${formatAiMoney(context.accountBalance)}. Bu dönemde nakit girişi ${formatAiMoney(context.cashIncome)} (${formatAiMoney(context.saleCollectionIncome)} tahsilat, ${formatAiMoney(context.manualIncome)} manuel), nakit çıkışı ${formatAiMoney(context.totalExpenses)}. Transferler gelir/gider toplamına dahil edilmez. ${context.unpaidInvoiceTotal > 0 ? `${formatAiMoney(context.unpaidInvoiceTotal)} tahsilat bekliyor.` : "Bekleyen tahsilat görünmüyor."}`;
  }

  return `Seçili dönem özeti: nakit girişi ${formatAiMoney(context.cashIncome)}, gider ${formatAiMoney(context.totalExpenses)}, nakit akışı ${formatAiMoney(context.profit)}. Satış cirosu ${formatAiMoney(context.totalSales)}. Risk skorunuz ${context.riskScore}/100 (${context.riskLevel}).`;
}

export function buildInitialAssistantMessage(context: AiAssistantContext) {
  return `Merhaba ${context.userFirstName}, ${context.periodLabel} verilerinizi inceledim. Nakit akışı ${formatAiMoney(context.profit)}, bekleyen tahsilat ${formatAiMoney(context.unpaidInvoiceTotal)}. Kâr, tahsilat, stok, transfer veya nakit akışı hakkında soru sorabilirsiniz.`;
}

export function buildAiAssistantQuery(params: {
  topic?: AiTopicKey;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.topic && params.topic !== "all") {
    search.set("topic", params.topic);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/ai-assistant?${query}` : "/ai-assistant";
}

export function topicShowsFinance(topic: AiTopicKey) {
  return topic === "all" || topic === "finance";
}

export function topicShowsCollection(topic: AiTopicKey) {
  return topic === "all" || topic === "collection";
}

export function topicShowsStock(topic: AiTopicKey) {
  return topic === "all" || topic === "stock";
}

export function topicShowsExpense(topic: AiTopicKey) {
  return topic === "all" || topic === "expense";
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
