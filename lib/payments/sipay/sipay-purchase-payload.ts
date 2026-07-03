import type { SipayEnv } from "./sipay-env";
import type {
  SipayPurchaseInvoice,
  SipayPurchaseLinkItem,
  SipayPurchaseLinkRequest,
} from "./sipay-types";
import { normalizeCurrency } from "@/lib/payments/money";

export type SipayPurchaseItemInput = {
  name: string;
  priceMinor: number;
  quantity: number;
  description?: string;
  productName?: string;
};

export type BuildSipayPurchaseLinkBodyInput = {
  env: Pick<
    SipayEnv,
    | "SIPAY_APP_ID"
    | "SIPAY_APP_SECRET"
    | "SIPAY_MERCHANT_KEY"
    | "SIPAY_MERCHANT_ID"
    | "SIPAY_SALE_WEBHOOK_KEY"
  >;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  payerEmail: string;
  payerName: string;
  payerPhone?: string;
  items: SipayPurchaseItemInput[];
  returnUrl: string;
  cancelUrl: string;
};

const DEFAULT_ITEM_DESCRIPTION = "Hesap İşleri üyelik paketi";
const MAX_ITEM_DESCRIPTION_LENGTH = 200;

function formatDecimal(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

function splitPayerName(payerName: string): { name: string; surname: string } {
  const parts = payerName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { name: "Musteri", surname: "" };
  }
  if (parts.length === 1) {
    return { name: parts[0], surname: "" };
  }
  return {
    name: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1] ?? "",
  };
}

function assertSupportedCurrency(currency: string): "TRY" {
  const normalized = normalizeCurrency(currency);
  if (normalized !== "TRY") {
    throw new Error(`Desteklenmeyen para birimi: ${currency}`);
  }
  return normalized;
}

function assertBillingCallbackUrl(url: string, label: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return;
    }
  } catch {
    // fall through
  }
  throw new Error(`${label} https:// veya http://localhost olmalıdır`);
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9\s()-]{7,20}$/.test(phone);
}

export function sanitizeSipayItemDescription(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveSipayItemDescription(item: SipayPurchaseItemInput): string {
  const raw =
    item.description?.trim() ||
    item.productName?.trim() ||
    item.name?.trim() ||
    DEFAULT_ITEM_DESCRIPTION;
  const sanitized = sanitizeSipayItemDescription(raw);
  return truncate(sanitized.length > 0 ? sanitized : DEFAULT_ITEM_DESCRIPTION, MAX_ITEM_DESCRIPTION_LENGTH);
}

export function validateSipayInvoiceItems(items: SipayPurchaseItemInput[]): void {
  if (items.length < 1) {
    throw new Error("Invoice en az bir item içermelidir");
  }

  for (const [index, item] of items.entries()) {
    if (!Number.isFinite(item.quantity) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Invoice item[${index}] quantity geçersiz`);
    }
    if (!Number.isFinite(item.priceMinor) || item.priceMinor <= 0) {
      throw new Error(`Invoice item[${index}] fiyatı pozitif olmalıdır`);
    }
    const description = resolveSipayItemDescription(item);
    if (!description) {
      throw new Error(`Invoice item[${index}] description boş olamaz`);
    }
  }
}

export function buildSipayPurchaseInvoice(
  input: BuildSipayPurchaseLinkBodyInput,
): SipayPurchaseInvoice {
  assertBillingCallbackUrl(input.returnUrl, "return_url");
  assertBillingCallbackUrl(input.cancelUrl, "cancel_url");
  validateSipayInvoiceItems(input.items);

  const total = formatDecimal(input.amountMinor);
  const itemRows: SipayPurchaseLinkItem[] = input.items.map((item) => ({
    name: truncate(item.name, 120),
    description: resolveSipayItemDescription(item),
    price: formatDecimal(item.priceMinor),
    quantity: item.quantity,
    type: 1,
  }));

  const itemsTotalMinor = input.items.reduce(
    (sum, item) => sum + item.priceMinor * item.quantity,
    0,
  );
  if (itemsTotalMinor !== input.amountMinor) {
    throw new Error("Invoice items toplamı payment total ile eşleşmiyor");
  }

  const invoice: SipayPurchaseInvoice = {
    invoice_id: input.invoiceId,
    invoice_description: truncate(`Hesap İşleri — ${input.invoiceId}`, 200),
    total,
    discount: 0,
    coupon: null,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    items: itemRows,
    response_method: "POST",
  };

  if (isValidEmail(input.payerEmail)) {
    invoice.bill_email = input.payerEmail;
  }

  if (input.payerPhone && isValidPhone(input.payerPhone)) {
    invoice.bill_phone = input.payerPhone;
  }

  if (input.env.SIPAY_SALE_WEBHOOK_KEY) {
    invoice.sale_web_hook_key = input.env.SIPAY_SALE_WEBHOOK_KEY;
  }

  return invoice;
}

export function serializeSipayPurchaseInvoice(invoice: SipayPurchaseInvoice): string {
  return JSON.stringify(invoice);
}

/** Resmî Sipay purchase/link body — `invoice` top-level JSON string. */
export function buildSipayPurchaseLinkBody(
  input: BuildSipayPurchaseLinkBodyInput,
): SipayPurchaseLinkRequest {
  const currencyCode = assertSupportedCurrency(input.currency);
  const invoice = buildSipayPurchaseInvoice(input);
  const { name, surname } = splitPayerName(input.payerName);

  return {
    merchant_key: input.env.SIPAY_MERCHANT_KEY,
    merchant_id: input.env.SIPAY_MERCHANT_ID,
    name,
    surname,
    currency_code: currencyCode,
    invoice: serializeSipayPurchaseInvoice(invoice),
  };
}
