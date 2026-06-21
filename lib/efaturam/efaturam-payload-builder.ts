import type {
  Company,
  Customer,
  EfaturamConnectionMode,
  Invoice,
  InvoiceItem,
} from "@prisma/client";
import {
  assertPositiveInvoiceMinor,
  invoiceMoneyToMinor,
  quantityToProviderValue,
} from "@/lib/efaturam/efaturam-money";

type InvoiceWithRelations = Invoice & {
  items: InvoiceItem[];
  customer: Customer | null;
  company: Company;
};

export type BuildEfaturamPayloadInput = {
  invoice: InvoiceWithRelations;
  connectionMode: EfaturamConnectionMode | null;
  providerCompanyId: string;
  providerUserId: string;
  prefix?: string | null;
  xsltCode?: string | null;
  targetAlias?: string | null;
  documentType: "E_INVOICE" | "E_ARCHIVE";
  internetSale?: boolean;
};

type VatBreakdown = {
  vatRate: number;
  taxableAmount: number;
  taxAmount: number;
};

function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { name: parts[0] ?? name, surname: "-" };
  }
  return {
    name: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
  };
}

function buildRecipientInfo(invoice: InvoiceWithRelations) {
  const customer = invoice.customer;
  const taxId = (customer?.taxNo ?? "").replace(/\D/g, "");
  if (!taxId) {
    throw new Error("Alıcı VKN/TCKN bilgisi eksik.");
  }

  const customerName = customer?.name?.trim() || "Müşteri";
  const { name, surname } = splitCustomerName(customerName);

  return {
    taxId,
    countryCode: "TR",
    city: "İstanbul",
    district: customer?.address?.split(",")[0]?.trim() || "Merkez",
    address: customer?.address?.trim() || "Adres bilgisi girilmedi",
    phone: customer?.phone?.replace(/\s/g, "") || undefined,
    email: customer?.email?.trim() || undefined,
    name,
    surname,
    taxOffice: customer?.taxOffice?.trim() || undefined,
    title: customerName.length > 10 ? customerName : undefined,
  };
}

function buildVatBreakdown(items: InvoiceItem[]): VatBreakdown[] {
  const map = new Map<number, VatBreakdown>();

  for (const item of items) {
    const vatRate = Number(item.vatRate);
    const taxableAmount = invoiceMoneyToMinor(item.lineNetAmount);
    const taxAmount = invoiceMoneyToMinor(item.vatAmount);
    const existing = map.get(vatRate);

    if (existing) {
      existing.taxableAmount += taxableAmount;
      existing.taxAmount += taxAmount;
      continue;
    }

    map.set(vatRate, { vatRate, taxableAmount, taxAmount });
  }

  return [...map.values()].sort((a, b) => a.vatRate - b.vatRate);
}

function buildInvoiceLines(items: InvoiceItem[]) {
  return items
    .slice()
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .map((item, index) => {
      const quantity = quantityToProviderValue(item.quantity);
      const unitPrice = invoiceMoneyToMinor(item.unitPrice);
      const lineNetAmount = invoiceMoneyToMinor(item.lineNetAmount);
      const vatAmount = invoiceMoneyToMinor(item.vatAmount);
      const lineGrossAmount = invoiceMoneyToMinor(item.lineGrossAmount);
      const discountAmount = invoiceMoneyToMinor(item.discountAmount);

      return {
        lineId: index + 1,
        name: item.productName,
        quantity,
        unit: item.unit?.trim() || "C62",
        unitPrice,
        vatRate: Number(item.vatRate),
        discountAmount,
        taxExcludedPrice: lineNetAmount,
        taxAmount: vatAmount,
        price: lineGrossAmount,
      };
    });
}

function buildPaymentAndDeliveryInfo(invoice: InvoiceWithRelations) {
  const customer = invoice.customer;
  const paymentDate = invoice.createdAt.toISOString().slice(0, 10);

  return {
    paymentInfo: {
      paymentType: "CREDITCARD",
      paymentDate,
      paymentNote: `Fatura ${invoice.invoiceNo}`,
    },
    deliveryInfo: {
      deliveryType: "ELECTRONIC",
      deliveryDate: paymentDate,
      deliveryNote: customer?.email
        ? `Teslimat e-posta: ${customer.email}`
        : "Elektronik teslimat",
    },
  };
}

export function buildEfaturamDocumentPayload(input: BuildEfaturamPayloadInput) {
  const { invoice } = input;
  const items = invoice.items;
  if (!items.length) {
    throw new Error("Faturada kalem bulunmuyor.");
  }

  const taxExcludedPrice = invoiceMoneyToMinor(invoice.taxableAmount);
  const taxAmount = invoiceMoneyToMinor(invoice.totalVat);
  const discountAmount = invoiceMoneyToMinor(invoice.totalDiscount);
  const price = invoiceMoneyToMinor(invoice.total);
  assertPositiveInvoiceMinor(price);

  const vatBreakdown = buildVatBreakdown(items);
  const source =
    input.connectionMode === "MARKETPLACE_PARTNER" ? "PARTNER" : "WEB";
  const scenario =
    input.documentType === "E_INVOICE"
      ? "TEMELFATURA"
      : input.internetSale
        ? "INTERNET"
        : "EARSIVFATURA";

  const payload: Record<string, unknown> = {
    autoInvoiceId: true,
    xsltCode: input.xsltCode ?? undefined,
    companyId: Number(input.providerCompanyId),
    userId: Number(input.providerUserId),
    localReferenceId: invoice.id,
    prefix: input.prefix ?? undefined,
    source,
    scenario,
    invoiceTypeCode: "SATIS",
    currency: "TRY",
    issuedAt: invoice.createdAt.toISOString(),
    recipientInfo: buildRecipientInfo(invoice),
    invoiceLines: buildInvoiceLines(items),
    taxExcludedPrice,
    taxAmount,
    discountAmount,
    price,
    payableAmount: price,
    taxInclusiveAmount: price,
    totalTax: {
      totalTaxAmount: taxAmount,
      subTotalTaxes: vatBreakdown.map((row) => ({
        taxableAmount: row.taxableAmount,
        taxAmount: row.taxAmount,
        taxType: "KDV",
        taxRate: row.vatRate,
      })),
    },
    orderInfos: [
      {
        orderId: invoice.invoiceNo,
        orderDate: invoice.createdAt.toISOString().slice(0, 10),
      },
    ],
    notes: invoice.saleId ? [`Satış referansı: ${invoice.saleId}`] : undefined,
  };

  if (input.documentType === "E_INVOICE") {
    if (!input.targetAlias) {
      throw new Error("E-Fatura için alıcı posta kutusu (alias) seçilmelidir.");
    }
    payload.targetAlias = input.targetAlias;
  }

  if (input.documentType === "E_ARCHIVE" && input.internetSale) {
    Object.assign(payload, buildPaymentAndDeliveryInfo(invoice));
  }

  return payload;
}
