import {
  getPosPaymentMethodLabel,
  getPosPaymentStatusLabel,
  type PosPaymentMethod,
  type PosPaymentStatus,
} from "@/lib/pos-checkout-utils";
import { getSaleRemainingAmount, roundMoney } from "@/lib/sale-payment-utils";

export type SaleReceiptWidthMm = 58 | 80;

export type SaleReceiptPaymentLine = {
  label: string;
  amount: number;
};

export type SaleReceiptItemView = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
};

export type SaleReceiptViewModel = {
  company: {
    name: string;
    phone: string | null;
    address: string | null;
    taxNo: string | null;
    taxOffice: string | null;
  };
  saleNo: string;
  dateLabel: string;
  cashierName: string | null;
  customerName: string;
  paymentStatus: PosPaymentStatus | string;
  paymentStatusLabel: string;
  isCancelled: boolean;
  items: SaleReceiptItemView[];
  subtotal: number;
  vatTotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentLines: SaleReceiptPaymentLine[];
  invoiceNo: string | null;
  note: string | null;
  widthMm: SaleReceiptWidthMm;
};

export function formatReceiptDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function resolveReceiptCustomerName(customerName: string | null | undefined) {
  const name = customerName?.trim();
  return name ? name : "Perakende Müşteri";
}

export function buildSaleReceiptPaymentLines(input: {
  paymentStatus: string;
  total: number;
  paidAmount: number;
  payments: Array<{
    paymentMethod: string;
    amount: number;
    accountName?: string | null;
  }>;
}): SaleReceiptPaymentLine[] {
  const total = roundMoney(input.total);
  const paidAmount = roundMoney(input.paidAmount);
  const remaining = getSaleRemainingAmount(total, paidAmount);
  const lines: SaleReceiptPaymentLine[] = [];

  for (const payment of input.payments) {
    const methodLabel = getPosPaymentMethodLabel(
      payment.paymentMethod as PosPaymentMethod
    );
    const account = payment.accountName?.trim();
    lines.push({
      label: account ? `${methodLabel} · ${account}` : methodLabel,
      amount: roundMoney(payment.amount),
    });
  }

  if (
    (input.paymentStatus === "UNPAID" || input.paymentStatus === "PARTIAL") &&
    remaining > 0
  ) {
    lines.push({
      label: "Cari'ye Yaz / Veresiye",
      amount: remaining,
    });
  }

  if (lines.length === 0 && input.paymentStatus === "PAID" && paidAmount > 0) {
    lines.push({
      label: getPosPaymentStatusLabel("PAID"),
      amount: paidAmount,
    });
  }

  return lines;
}

export function buildSaleReceiptViewModel(input: {
  company: {
    name: string;
    phone?: string | null;
    address?: string | null;
    taxNo?: string | null;
    taxOffice?: string | null;
  };
  sale: {
    saleNo: string;
    createdAt: Date;
    status: string;
    paymentStatus: string;
    subtotal: number;
    vatTotal: number;
    discount: number;
    total: number;
    paidAmount: number;
    note?: string | null;
    customerName?: string | null;
    cashierName?: string | null;
    invoiceNo?: string | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
      lineTotal: number;
    }>;
    payments: Array<{
      paymentMethod: string;
      amount: number;
      accountName?: string | null;
    }>;
  };
  widthMm?: SaleReceiptWidthMm;
}): SaleReceiptViewModel {
  const total = roundMoney(input.sale.total);
  const paidAmount = roundMoney(input.sale.paidAmount);
  const remainingAmount = getSaleRemainingAmount(total, paidAmount);
  const paymentStatus = input.sale.paymentStatus;

  return {
    company: {
      name: input.company.name,
      phone: input.company.phone ?? null,
      address: input.company.address ?? null,
      taxNo: input.company.taxNo ?? null,
      taxOffice: input.company.taxOffice ?? null,
    },
    saleNo: input.sale.saleNo,
    dateLabel: formatReceiptDateTime(input.sale.createdAt),
    cashierName: input.sale.cashierName?.trim() || null,
    customerName: resolveReceiptCustomerName(input.sale.customerName),
    paymentStatus,
    paymentStatusLabel: getPosPaymentStatusLabel(
      paymentStatus as PosPaymentStatus
    ),
    isCancelled:
      input.sale.status === "CANCELLED" || input.sale.status === "REFUNDED",
    items: input.sale.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: roundMoney(item.unitPrice),
      vatRate: item.vatRate,
      lineTotal: roundMoney(item.lineTotal),
    })),
    subtotal: roundMoney(input.sale.subtotal),
    vatTotal: roundMoney(input.sale.vatTotal),
    discount: roundMoney(input.sale.discount),
    total,
    paidAmount,
    remainingAmount,
    paymentLines: buildSaleReceiptPaymentLines({
      paymentStatus,
      total,
      paidAmount,
      payments: input.sale.payments,
    }),
    invoiceNo: input.sale.invoiceNo ?? null,
    note: input.sale.note?.trim() || null,
    widthMm: input.widthMm ?? 80,
  };
}
