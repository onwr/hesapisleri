import { db } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { createNotification } from "@/lib/notification-service";
import { applyCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { recordSaleCollection, resolveSalePayment } from "@/lib/sale-payment-utils";
import type { StockWarningItem } from "@/lib/stock-policy";
import {
  SaleStockValidationError,
  applySaleStockDecrement,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";
import {
  buildPosSaleItemTotal,
  buildPosSaleNote,
  calculatePosTotals,
  generatePosSaleNo,
  type PosCheckoutInput,
} from "@/lib/pos-checkout-utils";
import { validatePosPaymentAccount } from "@/lib/pos-payment-account-utils";
import { validateSaleLineItems } from "@/lib/sale-calculation-utils";
import { assertOptionalTenantCustomer } from "@/lib/tenant/tenant-resource";

export { SaleStockValidationError };

export async function executePosCheckout(input: {
  companyId: string;
  userId: string;
  data: PosCheckoutInput;
}) {
  const { companyId, userId, data } = input;

  const lineError = validateSaleLineItems(data.items);
  if (lineError) {
    throw new Error(lineError);
  }

  const totals = calculatePosTotals(data.items, data.discount);

  const payment = resolveSalePayment({
    paymentStatus: data.paymentStatus,
    total: totals.total,
    collectedAmount: data.collectedAmount,
  });

  let stockWarnings: StockWarningItem[] = [];

  await assertOptionalTenantCustomer(db, companyId, data.customerId);

  const sale = await db.$transaction(async (tx) => {
    const resolvedWarehouseId = await resolveWarehouseId(
      companyId,
      data.warehouseId,
      tx
    );

    stockWarnings = await validateSaleItemsStock(
      tx,
      companyId,
      data.items,
      resolvedWarehouseId
    );

    const createdSale = await tx.sale.create({
      data: {
        companyId,
        customerId: data.customerId || null,
        userId,
        warehouseId: resolvedWarehouseId,
        saleNo: generatePosSaleNo(),
        subtotal: totals.subtotal,
        vatTotal: totals.vatTotal,
        discount: totals.discount,
        total: totals.total,
        status: "COMPLETED",
        sourceChannel: "POS",
        orderStatus: "DELIVERED",
        deliveredAt: new Date(),
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        note: buildPosSaleNote({
          payments: data.payments,
          paymentStatus: payment.paymentStatus,
          note: data.note,
        }),
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            warehouseId: resolvedWarehouseId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: buildPosSaleItemTotal(item),
          })),
        },
      },
      include: {
        items: true,
        customer: true,
        payments: {
          include: {
            account: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    await applySaleStockDecrement(
      tx,
      companyId,
      createdSale.saleNo,
      data.items,
      resolvedWarehouseId
    );

    if (payment.paidAmount > 0) {
      for (const paymentLine of data.payments) {
        const account = await tx.account.findFirst({
          where: {
            id: paymentLine.accountId,
            companyId,
          },
        });

        const validation = validatePosPaymentAccount(
          account,
          companyId,
          paymentLine.paymentMethod
        );

        if (!validation.ok) {
          throw new Error(validation.message);
        }

        await tx.salePayment.create({
          data: {
            companyId,
            saleId: createdSale.id,
            accountId: validation.account.id,
            paymentMethod: paymentLine.paymentMethod,
            amount: paymentLine.amount,
          },
        });

        await recordSaleCollection(
          tx,
          {
            companyId,
            saleNo: createdSale.saleNo,
            amount: paymentLine.amount,
            accountId: validation.account.id,
            note: `${getPosPaymentCollectionNote(paymentLine.paymentMethod)} · ${validation.account.name} · ${createdSale.saleNo}`,
          },
          {
            validateAccount: (selectedAccount, tenantId) =>
              validatePosPaymentAccount(
                selectedAccount,
                tenantId,
                paymentLine.paymentMethod
              ),
          }
        );
      }

      const saleWithPayments = await tx.sale.findUniqueOrThrow({
        where: { id: createdSale.id },
        include: {
          items: true,
          customer: true,
          payments: {
            include: {
              account: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      });

      await applyCustomerDebtFromDocument(
        tx,
        companyId,
        data.customerId || null,
        totals.total,
        payment.paidAmount
      );

      const stockWarningNote =
        stockWarnings.length > 0
          ? ` (${stockWarnings.length} kalemde stok uyarısı)`
          : "";

      await tx.activityLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          module: "pos",
          message: `${saleWithPayments.saleNo} numaralı POS satışı oluşturuldu.${stockWarningNote}`,
        },
      });

      await createNotification(
        {
          companyId,
          userId,
          type: "SUCCESS",
          category: "SALES",
          module: "pos",
          entityType: "SALE",
          entityId: saleWithPayments.id,
          actionUrl: `/sales/${saleWithPayments.id}`,
          title: "POS satışı tamamlandı",
          message: `${saleWithPayments.saleNo} numaralı hızlı satış başarıyla tamamlandı.`,
        },
        tx
      );

      return saleWithPayments;
    }

    await applyCustomerDebtFromDocument(
      tx,
      companyId,
      data.customerId || null,
      totals.total,
      payment.paidAmount
    );

    const stockWarningNote =
      stockWarnings.length > 0
        ? ` (${stockWarnings.length} kalemde stok uyarısı)`
        : "";

    await tx.activityLog.create({
      data: {
        companyId,
        userId,
        action: "CREATE",
        module: "pos",
        message: `${createdSale.saleNo} numaralı POS satışı oluşturuldu.${stockWarningNote}`,
      },
    });

    await createNotification(
      {
        companyId,
        userId,
        type: "SUCCESS",
        category: "SALES",
        module: "pos",
        entityType: "SALE",
        entityId: createdSale.id,
        actionUrl: `/sales/${createdSale.id}`,
        title: "POS satışı tamamlandı",
        message: `${createdSale.saleNo} numaralı hızlı satış başarıyla tamamlandı.`,
      },
      tx
    );

    return createdSale;
  });

  invalidateDashboardCache(companyId, "pos-checkout");

  return { sale, stockWarnings };
}

function getPosPaymentCollectionNote(method: PosCheckoutInput["payments"][number]["paymentMethod"]) {
  if (method === "CASH") return "Nakit tahsilat";
  if (method === "CARD") return "Kart tahsilat";
  return "Havale/EFT tahsilat";
}
