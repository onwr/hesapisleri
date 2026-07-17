import "server-only";

import { db } from "@/lib/prisma";
import {
  buildSaleReceiptViewModel,
  type SaleReceiptViewModel,
  type SaleReceiptWidthMm,
} from "@/lib/sale-receipt-utils";

export class SaleReceiptNotFoundError extends Error {
  status = 404;

  constructor(message = "Satış bulunamadı.") {
    super(message);
    this.name = "SaleReceiptNotFoundError";
  }
}

export async function getSaleReceiptData(input: {
  companyId: string;
  saleId: string;
  widthMm?: SaleReceiptWidthMm;
}): Promise<SaleReceiptViewModel> {
  const [sale, company] = await Promise.all([
    db.sale.findFirst({
      where: {
        id: input.saleId,
        companyId: input.companyId,
      },
      include: {
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNo: true } },
        payments: {
          include: {
            account: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            vatRate: true,
            total: true,
            product: {
              select: {
                productType: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    db.company.findFirst({
      where: { id: input.companyId },
      select: {
        name: true,
        phone: true,
        address: true,
        taxNo: true,
        taxOffice: true,
      },
    }),
  ]);

  if (!sale || !company) {
    throw new SaleReceiptNotFoundError();
  }

  return buildSaleReceiptViewModel({
    company,
    widthMm: input.widthMm ?? 80,
    sale: {
      saleNo: sale.saleNo,
      createdAt: sale.createdAt,
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      subtotal: Number(sale.subtotal),
      vatTotal: Number(sale.vatTotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      paidAmount: Number(sale.paidAmount),
      note: sale.note,
      customerName: sale.customer?.name ?? null,
      cashierName: sale.user?.name ?? null,
      invoiceNo: sale.invoice?.invoiceNo ?? null,
      items: sale.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        vatRate: item.vatRate,
        lineTotal: Number(item.total),
      })),
      payments: sale.payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: Number(payment.amount),
        accountName: payment.account?.name ?? null,
      })),
    },
  });
}
