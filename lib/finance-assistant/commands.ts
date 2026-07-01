import { z } from "zod";

export const FINANCE_ASSISTANT_COMMANDS = [
  "TOTAL_SALES",
  "TOTAL_SALES_LAST_MONTH",
  "COLLECTED_AMOUNT",
  "GROSS_PROFIT",
  "TOTAL_EXPENSE",
  "NET_RESULT",
  "SALES_COMPARISON",
  "TOP_SELLING_PRODUCTS",
  "TOP_REVENUE_PRODUCTS",
  "TOP_PROFIT_PRODUCTS",
  "LOW_STOCK_PRODUCTS",
  "CASH_BANK_BALANCE",
  "CUSTOMER_RECEIVABLES",
  "SUPPLIER_PAYABLES",
  "PRODUCT_SALES",
  "PRODUCT_PURCHASES",
  "PRODUCT_STOCK",
] as const;

export type FinanceAssistantCommand = (typeof FINANCE_ASSISTANT_COMMANDS)[number];

export const FINANCE_ASSISTANT_PERIODS = [
  "TODAY",
  "THIS_WEEK",
  "THIS_MONTH",
  "LAST_MONTH",
  "LAST_30_DAYS",
  "THIS_YEAR",
  "CUSTOM",
] as const;

export type FinanceAssistantPeriod = (typeof FINANCE_ASSISTANT_PERIODS)[number];

export const COMMAND_LABELS: Record<FinanceAssistantCommand, string> = {
  TOTAL_SALES: "Bu ay toplam satış",
  TOTAL_SALES_LAST_MONTH: "Geçen ay toplam satış",
  COLLECTED_AMOUNT: "Bu ay tahsil edilen tutar",
  GROSS_PROFIT: "Bu ay brüt kâr",
  TOTAL_EXPENSE: "Bu ay toplam gider",
  NET_RESULT: "Bu ay net sonuç",
  SALES_COMPARISON: "Geçen aya göre satış karşılaştırması",
  TOP_SELLING_PRODUCTS: "En çok satılan ürünler",
  TOP_REVENUE_PRODUCTS: "En çok ciro yapan ürünler",
  TOP_PROFIT_PRODUCTS: "En çok kâr bırakan ürünler",
  LOW_STOCK_PRODUCTS: "Düşük stoklu ürünler",
  CASH_BANK_BALANCE: "Kasa ve banka bakiyeleri",
  CUSTOMER_RECEIVABLES: "Toplam müşteri alacağı",
  SUPPLIER_PAYABLES: "Toplam tedarikçi borcu",
  PRODUCT_SALES: "Ürün satış analizi",
  PRODUCT_PURCHASES: "Ürün alış/stok giriş analizi",
  PRODUCT_STOCK: "Ürün mevcut stok analizi",
};

export const COMMAND_CATEGORIES: Record<string, FinanceAssistantCommand[]> = {
  Satış: [
    "TOTAL_SALES",
    "TOTAL_SALES_LAST_MONTH",
    "COLLECTED_AMOUNT",
    "SALES_COMPARISON",
  ],
  Finans: [
    "GROSS_PROFIT",
    "TOTAL_EXPENSE",
    "NET_RESULT",
    "CASH_BANK_BALANCE",
    "CUSTOMER_RECEIVABLES",
    "SUPPLIER_PAYABLES",
  ],
  Ürün: [
    "PRODUCT_SALES",
    "PRODUCT_PURCHASES",
    "PRODUCT_STOCK",
    "TOP_SELLING_PRODUCTS",
    "TOP_REVENUE_PRODUCTS",
    "TOP_PROFIT_PRODUCTS",
  ],
  Stok: ["LOW_STOCK_PRODUCTS"],
};

// Commands that require a product selection
export const PRODUCT_COMMANDS = new Set<FinanceAssistantCommand>([
  "PRODUCT_SALES",
  "PRODUCT_PURCHASES",
  "PRODUCT_STOCK",
]);

// Commands where period selection is relevant
export const PERIOD_SENSITIVE_COMMANDS = new Set<FinanceAssistantCommand>([
  "TOTAL_SALES",
  "TOTAL_SALES_LAST_MONTH",
  "COLLECTED_AMOUNT",
  "GROSS_PROFIT",
  "TOTAL_EXPENSE",
  "NET_RESULT",
  "SALES_COMPARISON",
  "TOP_SELLING_PRODUCTS",
  "TOP_REVENUE_PRODUCTS",
  "TOP_PROFIT_PRODUCTS",
  "PRODUCT_SALES",
  "PRODUCT_PURCHASES",
]);

export const financeQuerySchema = z
  .object({
    command: z.enum(FINANCE_ASSISTANT_COMMANDS),
    period: z.enum(FINANCE_ASSISTANT_PERIODS).default("THIS_MONTH"),
    productId: z.string().trim().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.period === "CUSTOM") {
        return !!data.startDate && !!data.endDate;
      }
      return true;
    },
    { message: "CUSTOM dönem için startDate ve endDate zorunludur." }
  )
  .refine(
    (data) => {
      if (PRODUCT_COMMANDS.has(data.command)) {
        // productId required only for PRODUCT_SALES, PRODUCT_PURCHASES, PRODUCT_STOCK
        // when not provided, we return aggregate across all products
        return true;
      }
      return true;
    },
    { message: "Ürün komutu için productId gerekli." }
  );

export type FinanceQueryInput = z.infer<typeof financeQuerySchema>;
