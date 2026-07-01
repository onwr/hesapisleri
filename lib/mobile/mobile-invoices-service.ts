import { z } from "zod";
import { db } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { calculateInvoiceTotals } from "@/lib/invoice-form-utils";
import { calculateInvoiceLineSnapshots } from "@/lib/invoice-tax-calculation-utils";
import { applyCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { resolveSalePayment } from "@/lib/sale-payment-utils";
import {
  encodeNormalInvoiceMeta,
  type NormalInvoiceMeta,
} from "@/lib/normal-invoice-meta";
import { generateInvoiceNo, getMockGibMeta } from "@/lib/invoices/mock-gib";
import { persistInvoiceFinancialSnapshot } from "@/lib/invoice-snapshot-service";
import {
  collectInvoicePayment,
  getInvoiceDetailForPage,
  validateInvoiceCancelEligibility,
} from "@/lib/invoice-service";
import {
  getInvoiceRemainingAmount,
  collectInvoiceSchema,
} from "@/lib/invoice-payment-utils";
import {
  getInvoiceDueDate,
  isInvoiceOverdue,
  matchesInvoiceSearch,
} from "@/lib/invoices-page-utils";
import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import { reverseCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";

const PAGE_SIZE = 24;

export const mobileInvoiceItemSchema = z.object({
  name: z.string().min(1, "Ürün / hizmet adı zorunludur."),
  quantity: z.number().positive("Miktar 0'dan büyük olmalıdır."),
  unitPrice: z.number().min(0, "Birim fiyat negatif olamaz."),
  vatRate: z.number().finite(),
  productId: z.string().optional(),
});

export const mobileCreateInvoiceSchema = z.object({
  customerId: z.string().optional(),
  documentLabel: z.enum(["SATIS", "HIZMET", "PROFORMA"]).default("SATIS"),
  currency: z.enum(["TRY"]).default("TRY"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("UNPAID"),
  collectedAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).default(0),
  action: z.enum(["DRAFT", "CREATE"]).default("CREATE"),
  items: z.array(mobileInvoiceItemSchema).min(1, "En az bir kalem ekleyin."),
  subtotal: z.never().optional(),
  taxTotal: z.never().optional(),
  total: z.never().optional(),
});

function parseDateInput(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stripInvoiceDetail(invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceDetailForPage>>>) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNo,
    customer: invoice.customer
      ? { id: invoice.customer.id, name: invoice.customer.name, phone: invoice.customer.phone }
      : null,
    issueDate: invoice.createdAt.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    currency: "TRY" as const,
    total: invoice.total,
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    paymentHistory: invoice.collections.map((c) => ({
      id: c.id,
      amount: c.amount,
      date: c.date.toISOString(),
      note: c.note,
      accountName: c.accountName,
    })),
    canCollect: invoice.canCollect,
    canCancel: invoice.canCancel,
    eDocumentStatus: null as string | null,
  };
}

export async function listMobileInvoices(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  customerId?: string;
  status?: string;
  paymentStatus?: string;
  overdue?: boolean;
  from?: string;
  to?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.invoices.read) {
    throw new MobileFinanceError("FORBIDDEN", "Fatura görüntüleme yetkiniz yok.", 403);
  }

  const rows = await db.invoice.findMany({
    where: {
      companyId: input.companyId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.status ? { status: input.status as never } : {}),
      ...(input.paymentStatus ? { paymentStatus: input.paymentStatus as never } : {}),
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const now = new Date();
  let items = rows
    .filter((inv) =>
      !input.q?.trim() ||
      matchesInvoiceSearch(
        { invoiceNo: inv.invoiceNo, customerName: inv.customer?.name ?? "" },
        input.q.trim()
      )
    )
    .map((invoice) => {
      const total = Number(invoice.total);
      const paidAmount = Number(invoice.paidAmount);
      const remainingAmount = getInvoiceRemainingAmount(total, paidAmount);
      const dueDate = getInvoiceDueDate(invoice.createdAt, invoice.dueDate);
      const overdue = isInvoiceOverdue(
        invoice.paymentStatus,
        invoice.createdAt,
        invoice.dueDate,
        now
      );
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNo,
        customer: invoice.customer
          ? { id: invoice.customer.id, name: invoice.customer.name }
          : null,
        issueDate: invoice.createdAt.toISOString(),
        dueDate: dueDate.toISOString(),
        status: invoice.status,
        paymentStatus: invoice.paymentStatus,
        total,
        paidAmount,
        remainingAmount,
        currency: "TRY" as const,
        overdue,
      };
    });

  if (input.overdue) {
    items = items.filter((i) => i.overdue);
  }

  const hasMore = items.length > PAGE_SIZE;
  if (hasMore) items = items.slice(0, PAGE_SIZE);

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getMobileInvoiceById(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  invoiceId: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.invoices.read) {
    throw new MobileFinanceError("FORBIDDEN", "Fatura görüntüleme yetkiniz yok.", 403);
  }

  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, companyId: input.companyId },
    include: {
      customer: true,
      items: { orderBy: { lineIndex: "asc" } },
      transactions: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { account: true },
      },
    },
  });

  if (!invoice) {
    throw new MobileFinanceError("INVOICE_NOT_FOUND", "Fatura bulunamadı.", 404);
  }

  const detail = await getInvoiceDetailForPage(input.companyId, input.invoiceId);
  const { displayMessage } = parseNormalInvoiceMeta(invoice.gibMessage);
  const total = Number(invoice.total);

  return {
    permissions,
    invoice: {
      ...stripInvoiceDetail(detail!),
      note: displayMessage || null,
      items: invoice.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.productName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
        discount: Number(item.discountAmount),
        lineNetAmount: Number(item.lineNetAmount),
        vatAmount: Number(item.vatAmount),
        lineGrossAmount: Number(item.lineGrossAmount),
      })),
      subtotal: Number(invoice.subtotal),
      taxTotal: Number(invoice.totalVat),
      discount: Number(invoice.totalDiscount),
    },
  };
}

export async function createMobileInvoice(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.invoices.create) {
    throw new MobileFinanceError("FORBIDDEN", "Fatura oluşturma yetkiniz yok.", 403);
  }

  const parsed = mobileCreateInvoiceSchema.safeParse(input.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      fieldErrors as Record<string, string[]>
    );
  }

  const data = parsed.data;
  if (data.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: data.customerId, companyId: input.companyId },
    });
    if (!customer) {
      throw new MobileFinanceError("CUSTOMER_NOT_FOUND", "Müşteri bulunamadı.", 404);
    }
  }

  const productIds = data.items.map((i) => i.productId).filter(Boolean) as string[];
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { companyId: input.companyId, id: { in: productIds } },
          select: { id: true, name: true, sku: true, barcode: true, unitType: true },
        })
      : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const lineItems = data.items.map((item) => {
    const product = item.productId ? productMap.get(item.productId) : undefined;
    if (item.productId && !product) {
      throw new MobileFinanceError("INVALID_INVOICE_ITEM", "Ürün bulunamadı.", 400);
    }
    return {
      productId: item.productId,
      productName: item.name,
      sku: product?.sku ?? null,
      barcode: product?.barcode ?? null,
      unit: product?.unitType ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    };
  });

  const totals = calculateInvoiceTotals(
    lineItems.map((item) => ({ id: crypto.randomUUID(), name: item.productName, ...item })),
    data.discountAmount
  );
  const lineSnapshots = calculateInvoiceLineSnapshots(lineItems, data.discountAmount);

  let invoicePaidAmount = 0;
  try {
    const payment = resolveSalePayment({
      paymentStatus: data.paymentStatus,
      total: totals.total,
      collectedAmount: data.collectedAmount,
    });
    invoicePaidAmount = payment.paidAmount;
  } catch (error) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Ödeme bilgileri geçersiz.",
      400
    );
  }

  const status = data.action === "DRAFT" ? "DRAFT" : "SENT";
  const gib = getMockGibMeta("NORMAL", status);
  const meta: NormalInvoiceMeta = {
    v: 1,
    documentLabel: data.documentLabel,
    currency: data.currency,
    invoiceDate: data.invoiceDate ?? new Date().toISOString().slice(0, 10),
    discountAmount: totals.discount,
    subtotal: totals.subtotal,
    taxableAmount: totals.taxableAmount,
    totalVat: totals.totalVat,
    grandTotal: totals.grandTotal,
    items: lineItems.map((item, index) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      productId: item.productId,
      lineNetAmount: lineSnapshots[index]!.lineNetAmount,
      vatAmount: lineSnapshots[index]!.vatAmount,
      lineGrossAmount: lineSnapshots[index]!.lineGrossAmount,
      discountAmount: lineSnapshots[index]!.discountAmount,
    })),
  };

  const created = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        companyId: input.companyId,
        customerId: data.customerId || null,
        invoiceNo: generateInvoiceNo("NORMAL"),
        type: "NORMAL",
        status,
        subtotal: totals.subtotal,
        totalDiscount: totals.discount,
        taxableAmount: totals.taxableAmount,
        totalVat: totals.totalVat,
        total: totals.total,
        financialSnapshotStatus: "COMPLETE",
        paymentStatus: data.paymentStatus,
        paidAmount: invoicePaidAmount,
        dueDate: parseDateInput(data.dueDate),
        gibStatus: gib.gibStatus,
        gibMessage: encodeNormalInvoiceMeta(gib.gibMessage, meta),
      },
      include: { customer: true },
    });

    await persistInvoiceFinancialSnapshot(tx, {
      invoiceId: invoice.id,
      items: lineItems,
      invoiceDiscountAmount: data.discountAmount,
    });

    if (data.action !== "DRAFT" && data.customerId) {
      await applyCustomerDebtFromDocument(
        tx,
        input.companyId,
        data.customerId,
        totals.total,
        invoicePaidAmount
      );
    }

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: data.action === "DRAFT" ? "DRAFT" : "CREATE",
        module: "invoices",
        message: `${invoice.invoiceNo} mobil fatura oluşturuldu.`,
      },
    });

    await createNotification(
      {
        companyId: input.companyId,
        userId: input.userId,
        type: "SUCCESS",
        category: "INVOICES",
        module: "invoices",
        entityType: "INVOICE",
        entityId: invoice.id,
        actionUrl: `/invoices/${invoice.id}`,
        title: "Fatura oluşturuldu",
        message: `${invoice.invoiceNo} kaydı oluşturuldu.`,
      },
      tx
    );

    return invoice;
  });

  if (data.action !== "DRAFT") {
    invalidateDashboardCache(input.companyId, "invoice-create");
  }

  return getMobileInvoiceById({
    companyId: input.companyId,
    role: input.role,
    isOwner: input.isOwner,
    invoiceId: created.id,
  });
}

export async function cancelMobileInvoice(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  invoiceId: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.invoices.cancel) {
    throw new MobileFinanceError("FORBIDDEN", "Fatura iptal yetkiniz yok.", 403);
  }

  const invoice = await db.invoice.findFirst({
    where: { id: input.invoiceId, companyId: input.companyId },
  });
  if (!invoice) {
    throw new MobileFinanceError("INVOICE_NOT_FOUND", "Fatura bulunamadı.", 404);
  }

  const eligibility = validateInvoiceCancelEligibility(invoice);
  if (!eligibility.ok) {
    throw new MobileFinanceError("INVALID_INVOICE_STATUS", eligibility.message, 400);
  }

  await db.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "CANCELLED", paymentStatus: "UNPAID", paidAmount: 0 },
    });
    if (invoice.customerId) {
      await reverseCustomerDebtFromDocument(
        tx,
        input.companyId,
        invoice.customerId,
        Number(invoice.total),
        Number(invoice.paidAmount)
      );
    }
    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CANCEL",
        module: "invoices",
        message: `${invoice.invoiceNo} iptal edildi.`,
      },
    });
  });

  invalidateDashboardCache(input.companyId, "invoice-cancel");
  return getMobileInvoiceById(input);
}

export { collectInvoiceSchema };

export async function collectMobileInvoicePayment(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  invoiceId: string;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.collections.create) {
    throw new MobileFinanceError("FORBIDDEN", "Tahsilat yetkiniz yok.", 403);
  }

  const parsed = collectInvoiceSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const account = await db.account.findFirst({
    where: { id: parsed.data.accountId, companyId: input.companyId },
  });
  if (!account) {
    throw new MobileFinanceError("COLLECTION_ACCOUNT_NOT_FOUND", "Ödeme hesabı bulunamadı.", 404);
  }

  const result = await collectInvoicePayment({
    companyId: input.companyId,
    userId: input.userId,
    invoiceId: input.invoiceId,
    data: parsed.data,
  });

  if (!result.ok) {
    const code =
      result.status === 404
        ? "INVOICE_NOT_FOUND"
        : result.message.includes("En fazla")
          ? "COLLECTION_AMOUNT_EXCEEDS_REMAINING"
          : "INVALID_COLLECTION_AMOUNT";
    throw new MobileFinanceError(code, result.message, result.status);
  }

  invalidateDashboardCache(input.companyId, "invoice-collect");
  return {
    invoice: {
      id: result.data.id,
      paymentStatus: result.data.paymentStatus,
      paidAmount: result.data.paidAmount,
      remainingAmount: result.data.remainingAmount,
      total: result.data.total,
    },
  };
}
