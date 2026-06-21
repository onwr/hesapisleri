import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/format-utils";
import { getActivityTag } from "@/lib/dashboard-metrics";

export type ActivityModule =
  | "dashboard"
  | "products"
  | "stocks"
  | "sales"
  | "orders"
  | "pos"
  | "expenses"
  | "customers"
  | "suppliers"
  | "cash-bank"
  | "cash_bank"
  | "invoices"
  | "e-invoice"
  | "calendar"
  | "directory"
  | "company"
  | "admin"
  | "settings"
  | "employees"
  | "team"
  | string;

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PAY"
  | "COLLECT"
  | "APPROVE"
  | "SYNC"
  | "IMPORT"
  | "PRINT"
  | "LOGIN"
  | "REGISTER"
  | "SEND"
  | string;

export const DEMO_ACTIVITY_MESSAGE_PATTERNS = [
  /^Kırtasiye alımı 350$/i,
  /^Kırtasiye alımı$/i,
  /^Açıklama:\s*Kırtasiye Alımı$/i,
  /^Müşteri:\s*Mehmet Kaya$/i,
  /^Fatura No:\s*FTR-2026-00035$/i,
  /^Müşteri:\s*ABC Ltd\. Şti\.$/i,
] as const;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Oluşturma",
  UPDATE: "Güncelleme",
  DELETE: "Silme",
  PAY: "Ödeme",
  COLLECT: "Tahsilat",
  TRANSFER: "Transfer",
  APPROVE: "Onay",
  SYNC: "Senkronizasyon",
  IMPORT: "İçe aktarma",
  PRINT: "Yazdırma",
  LOGIN: "Giriş",
  REGISTER: "Kayıt",
  SEND: "Gönderim",
};

const MODULE_LABELS: Record<string, string> = {
  products: "Ürünler",
  stocks: "Stok",
  sales: "Satış",
  orders: "Sipariş",
  pos: "POS",
  expenses: "Gider",
  customers: "Müşteri",
  suppliers: "Tedarikçi",
  "cash-bank": "Kasa/Banka",
  cash_bank: "Kasa/Banka",
  invoices: "Fatura",
  "e-invoice": "e-Fatura",
  calendar: "Takvim",
  directory: "Rehber",
  company: "Şirket",
  admin: "Yönetim",
  settings: "Ayarlar",
  employees: "Personel",
  team: "Ekip",
};

type DbClient = Prisma.TransactionClient | typeof db;

export type CreateActivityLogInput = {
  companyId: string;
  userId?: string | null;
  module: ActivityModule;
  action: ActivityAction;
  message: string;
  ip?: string | null;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  description: string | null;
  amountLabel: string | null;
  tag: string;
  tagColor: "green" | "blue" | "orange" | "purple" | "slate";
  time: string;
  href: string | null;
};

export function isDemoActivityMessage(message: string | null | undefined) {
  const normalized = message?.trim();
  if (!normalized) return false;

  return DEMO_ACTIVITY_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function formatActivityActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function formatActivityModuleLabel(module: string) {
  return MODULE_LABELS[module] ?? module;
}

export function buildTransferActivityMessage(
  fromAccountName: string,
  toAccountName: string,
  amount: number
) {
  return `Hesaplar arası transfer: ${fromAccountName} → ${toAccountName} - ${formatMoney(amount)}`;
}

const LEGACY_TRANSFER_MESSAGE =
  /^(.+?) hesabından (.+?) hesabına ([\d.,]+) TRY transfer edildi\.?$/i;

export function isTransferActivityLog(log: {
  action: string;
  module: string;
  message: string | null;
}) {
  const message = log.message?.trim();
  if (!message) return false;

  if (log.action === "TRANSFER") return true;

  return (
    (log.module === "cash-bank" || log.module === "cash_bank") &&
    (message.includes("Hesaplar arası transfer") ||
      LEGACY_TRANSFER_MESSAGE.test(message))
  );
}

export function resolveTransferActivityTitle(message: string) {
  const trimmed = message.trim();

  if (trimmed.startsWith("Hesaplar arası transfer:")) {
    return trimmed.replace(/\s*-\s*₺[\d.,]+(?:,\d{2})?$/, "").trim();
  }

  const legacy = trimmed.match(LEGACY_TRANSFER_MESSAGE);
  if (legacy) {
    return `Hesaplar arası transfer: ${legacy[1]} → ${legacy[2]}`;
  }

  return trimmed;
}

export function resolveTransferActivitySubtitle() {
  return "Kasa-Banka · Transfer";
}

export function buildActivitySubtitle(action: string, module: string) {
  const moduleLabel = formatActivityModuleLabel(module);
  const actionLabel = formatActivityActionLabel(action);
  return `${moduleLabel} · ${actionLabel}`;
}

export function extractAmountLabelFromMessage(message: string | null | undefined) {
  if (!message) return null;

  const tryMatch = message.match(/₺\s*[\d.,]+/);
  if (tryMatch) return tryMatch[0].replace(/\s+/g, "");

  const amountMatch = message.match(
    /(-?\d[\d.,]*)\s*(?:TL|TRY|₺)/i
  );
  if (amountMatch) {
    const numeric = Number(
      amountMatch[1].replace(/\./g, "").replace(",", ".")
    );
    if (Number.isFinite(numeric)) {
      return formatMoney(numeric);
    }
  }

  return null;
}

export function resolveActivityHref(module: string, _action: string) {
  if (module === "sales" || module === "pos") return "/sales";
  if (module === "orders") return "/orders";
  if (module === "expenses") return "/expenses";
  if (module === "products" || module === "stocks") return "/products";
  if (module === "customers") return "/customers";
  if (module === "suppliers") return "/suppliers";
  if (module === "invoices" || module === "e-invoice") return "/invoices";
  if (module === "cash-bank" || module === "cash_bank") return "/cash-bank";
  return null;
}

export function mapActivityLogToDashboardItem(
  log: {
    id: string;
    action: string;
    module: string;
    message: string | null;
    createdAt: Date;
  },
  formatTime: (date: Date) => string
): DashboardActivityItem | null {
  const message = log.message?.trim();
  if (!message || isDemoActivityMessage(message)) {
    return null;
  }

  const isTransfer = isTransferActivityLog(log);
  const tag = getActivityTag(log.module, log.action, { isTransfer });

  return {
    id: log.id,
    title: isTransfer ? resolveTransferActivityTitle(message) : message,
    description: isTransfer
      ? resolveTransferActivitySubtitle()
      : buildActivitySubtitle(log.action, log.module),
    amountLabel: extractAmountLabelFromMessage(message),
    tag: tag.label,
    tagColor: tag.color,
    time: formatTime(log.createdAt),
    href: resolveActivityHref(log.module, log.action),
  };
}

export async function createActivityLog(
  input: CreateActivityLogInput,
  client: DbClient = db
) {
  const message = input.message.trim();
  if (!message) {
    throw new Error("Activity log message is required.");
  }

  if (isDemoActivityMessage(message)) {
    throw new Error("Demo activity messages are not allowed.");
  }

  return client.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      message,
      ip: input.ip ?? null,
    },
  });
}

export function getDemoActivityCleanupWhere() {
  return {
    OR: [
      { message: { equals: "Kırtasiye alımı 350" } },
      { message: { equals: "Kırtasiye alımı" } },
      { message: { equals: "Kırtasiye Alımı" } },
      { message: { equals: "Açıklama: Kırtasiye Alımı" } },
      { message: { equals: "Müşteri: Mehmet Kaya" } },
      { message: { equals: "Fatura No: FTR-2026-00035" } },
      { message: { equals: "Müşteri: ABC Ltd. Şti." } },
    ],
  };
}
