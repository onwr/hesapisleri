import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { adjustCustomerBalance } from "@/lib/customer-balance-utils";
import {
  buildFinanceMirrorNote,
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";
import {
  assertCancelReasonProvided,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";
import { derivePaymentStatus } from "@/lib/sale-payment-utils";
import { resolveInvoicePaidState } from "@/lib/invoice-payment-utils";

type ServiceResult<T> =
  | { ok: true; data: T; replayed?: boolean }
  | { ok: false; status: number; message: string };

export async function reverseInvoiceCollection(input: {
  companyId: string;
  userId: string;
  accountTransactionId: string;
  reason: string;
}): Promise<
  ServiceResult<{
    reversalTransactionId: string;
    invoiceId: string | null;
  }>
> {
  const reason = input.reason?.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "İptal nedeni zorunludur." };
  }

  const result = await db.$transaction(async (tx) => {
    const sourceTx = await tx.accountTransaction.findFirst({
      where: {
        id: input.accountTransactionId,
        account: { companyId: input.companyId },
      },
      include: {
        account: true,
        invoice: {
          include: { sale: true },
        },
      },
    });

    if (!sourceTx) {
      return { ok: false as const, status: 404, message: "Tahsilat kaydı bulunamadı." };
    }

    if (sourceTx.type !== "INCOME" || !sourceTx.invoiceId) {
      return {
        ok: false as const,
        status: 400,
        message:
          "Yalnızca fatura tahsilat hareketleri ters kayıt ile iptal edilebilir.",
      };
    }

    if (isFinanceMirrorTransaction(sourceTx)) {
      return {
        ok: false as const,
        status: 409,
        message: "Bu tahsilat zaten iptal edilmiş.",
      };
    }

    const mirrorExists = await tx.accountTransaction.findFirst({
      where: {
        accountId: sourceTx.accountId,
        invoiceId: sourceTx.invoiceId,
        type: "EXPENSE",
        note: { contains: sourceTx.id },
      },
    });

    if (mirrorExists) {
      return {
        ok: true as const,
        data: {
          reversalTransactionId: mirrorExists.id,
          invoiceId: sourceTx.invoiceId,
        },
        replayed: true,
      };
    }

    assertCancelReasonProvided({ state: "POSTED", reason });

    const amount = roundCashMoney(Number(sourceTx.amount));
    const invoice = sourceTx.invoice!;

    if (invoice.status === "CANCELLED") {
      return {
        ok: false as const,
        status: 400,
        message: "İptal edilmiş faturanın tahsilatı geri alınamaz.",
      };
    }

    const currentPaid = roundCashMoney(Number(invoice.paidAmount));
    if (currentPaid < amount) {
      return {
        ok: false as const,
        status: 400,
        message: "Tahsilat tutarı fatura ödeme durumu ile uyumsuz.",
      };
    }

    await tx.account.update({
      where: { id: sourceTx.accountId },
      data: { balance: { decrement: amount } },
    });

    const reversal = await tx.accountTransaction.create({
      data: {
        accountId: sourceTx.accountId,
        type: "EXPENSE",
        title: `Tahsilat İptali - ${invoice.invoiceNo}`,
        amount,
        date: new Date(),
        note: buildFinanceMirrorNote(
          "REVERSAL",
          `${invoice.invoiceNo} tahsilatı iptal edildi. Kaynak: ${sourceTx.id}. Neden: ${reason}`
        ),
        invoiceId: invoice.id,
      },
    });

    const nextPaid = roundCashMoney(currentPaid - amount);
    const nextState = resolveInvoicePaidState(Number(invoice.total), nextPaid);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: nextState.paidAmount,
        paymentStatus: nextState.paymentStatus,
      },
    });

    if (invoice.saleId && invoice.sale) {
      const saleTotal = Number(invoice.sale.total);
      const saleNextPaid = roundCashMoney(
        Math.max(0, Number(invoice.sale.paidAmount) - amount)
      );
      await tx.sale.update({
        where: { id: invoice.sale.id },
        data: {
          paidAmount: saleNextPaid,
          paymentStatus: derivePaymentStatus(saleTotal, saleNextPaid),
        },
      });
    }

    if (invoice.customerId) {
      await adjustCustomerBalance(tx, input.companyId, invoice.customerId, amount);
    }

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "invoices",
      entityType: "INVOICE_COLLECTION",
      entityId: sourceTx.id,
      action: "REVERSE",
      message: `${invoice.invoiceNo} tahsilatı ters kayıt ile iptal edildi.`,
      reason,
      relatedTransactionIds: [sourceTx.id, reversal.id],
    });

    return {
      ok: true as const,
      data: {
        reversalTransactionId: reversal.id,
        invoiceId: invoice.id,
      },
    };
  });

  if (result.ok && !("replayed" in result && result.replayed)) {
    invalidateDashboardCache(input.companyId, "invoice-collect");
  }

  return result;
}
