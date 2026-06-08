import { db } from "../lib/prisma";
import { applyCustomerDebtFromDocument } from "../lib/customer-balance-utils";
import { generateQuoteNo, generateSaleNo } from "../lib/sale-number-utils";
import {
  recordSaleCollection,
  resolveSalePayment,
  roundMoney,
  type SalePaymentMethod,
} from "../lib/sale-payment-utils";
import { isQuoteSaleStatus } from "../lib/sale-query-utils";
import {
  applySaleStockDecrement,
  SaleStockValidationError,
  validateSaleItemsStock,
} from "../lib/sale-stock-utils";

const TEST_COMPANY_NAME = "TEST_QUOTE_FLOW_COMPANY";
const TEST_CUSTOMER_NAME = "TEST_QUOTE_CUSTOMER";
const TEST_PRODUCT_NAME = "TEST_QUOTE_PRODUCT";
const TEST_ACCOUNT_NAME = "TEST_QUOTE_CASH";
const TEST_USER_EMAIL = "test-quote-flow@hesapisleri.local";

type QuoteItemInput = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

type TestContext = {
  companyId: string;
  userId: string;
  customerId: string;
  productId: string;
  accountId: string;
};

function assertEqual(label: string, actual: number | string, expected: number | string) {
  if (typeof actual === "number" && typeof expected === "number") {
    const a = roundMoney(actual);
    const e = roundMoney(expected);

    if (a !== e) {
      throw new Error(`${label}: beklenen ${e}, gelen ${a}`);
    }

    return;
  }

  if (actual !== expected) {
    throw new Error(`${label}: beklenen ${expected}, gelen ${actual}`);
  }
}

function assertTrue(label: string, value: boolean) {
  if (!value) {
    throw new Error(`${label}: koşul sağlanmadı`);
  }
}

function assertStartsWith(label: string, value: string, prefix: string) {
  assertTrue(label, value.startsWith(prefix));
}

function calcTotals(items: QuoteItemInput[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const vatTotal = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    return sum + (itemTotal * item.vatRate) / 100;
  }, 0);

  return {
    subtotal,
    vatTotal,
    total: subtotal + vatTotal,
  };
}

async function getProductStock(productId: string) {
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stock: true },
  });

  return product.stock;
}

async function getCustomerBalance(customerId: string) {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { balance: true },
  });

  return Number(customer.balance);
}

async function getAccountBalance(accountId: string) {
  const account = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { balance: true },
  });

  return Number(account.balance);
}

async function getSaleSnapshot(saleId: string) {
  return db.sale.findUniqueOrThrow({
    where: { id: saleId },
    select: {
      id: true,
      status: true,
      saleNo: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
    },
  });
}

async function cleanupTestCompany() {
  await db.company.deleteMany({
    where: { name: TEST_COMPANY_NAME },
  });

  await db.user.deleteMany({
    where: { email: TEST_USER_EMAIL },
  });
}

async function setupTestContext(): Promise<TestContext> {
  await cleanupTestCompany();

  const company = await db.company.create({
    data: {
      name: TEST_COMPANY_NAME,
      status: "ACTIVE",
    },
  });

  const user = await db.user.create({
    data: {
      name: "Test Quote Flow User",
      email: TEST_USER_EMAIL,
      password: "test-password-hash",
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  await db.companyUser.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: "OWNER",
      isOwner: true,
      status: "ACTIVE",
    },
  });

  const customer = await db.customer.create({
    data: {
      companyId: company.id,
      name: TEST_CUSTOMER_NAME,
      balance: 0,
      status: "ACTIVE",
    },
  });

  const product = await db.product.create({
    data: {
      companyId: company.id,
      name: TEST_PRODUCT_NAME,
      stock: 10,
      sellPrice: 100,
      vatRate: 20,
      status: "ACTIVE",
    },
  });

  const account = await db.account.create({
    data: {
      companyId: company.id,
      type: "CASH",
      name: TEST_ACCOUNT_NAME,
      balance: 0,
      currency: "TRY",
      status: "ACTIVE",
    },
  });

  return {
    companyId: company.id,
    userId: user.id,
    customerId: customer.id,
    productId: product.id,
    accountId: account.id,
  };
}

async function createQuote(
  ctx: TestContext,
  items: QuoteItemInput[],
  note?: string
) {
  const { subtotal, vatTotal, total } = calcTotals(items);

  return db.$transaction(async (tx) => {
    const quote = await tx.sale.create({
      data: {
        companyId: ctx.companyId,
        customerId: ctx.customerId,
        userId: ctx.userId,
        saleNo: generateQuoteNo(),
        subtotal,
        vatTotal,
        discount: 0,
        total,
        paymentStatus: "UNPAID",
        paidAmount: 0,
        status: "DRAFT",
        note: note ?? null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    return quote;
  });
}

async function convertQuote(
  ctx: TestContext,
  saleId: string,
  input: {
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
    collectedAmount?: number;
    paymentMethod?: SalePaymentMethod;
  }
) {
  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      companyId: ctx.companyId,
    },
    include: {
      items: true,
    },
  });

  if (!sale) {
    throw new Error("Teklif bulunamadı.");
  }

  if (!isQuoteSaleStatus(sale.status)) {
    return {
      ok: false as const,
      status: 400,
      message: "Sadece taslak teklifler satışa dönüştürülebilir.",
    };
  }

  const total = Number(sale.total);
  const payment = resolveSalePayment({
    paymentStatus: input.paymentStatus,
    total,
    collectedAmount: input.collectedAmount,
  });

  const stockItems = sale.items.map((item) => ({
    productId: item.productId ?? undefined,
    quantity: item.quantity,
    name: item.name,
  }));

  try {
    const updatedSale = await db.$transaction(async (tx) => {
      await validateSaleItemsStock(tx, ctx.companyId, stockItems);

      const newSaleNo = generateSaleNo();

      const converted = await tx.sale.update({
        where: { id: sale.id },
        data: {
          saleNo: newSaleNo,
          status: "COMPLETED",
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
        },
      });

      await applySaleStockDecrement(tx, ctx.companyId, newSaleNo, sale.items);

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: ctx.companyId,
          saleNo: newSaleNo,
          amount: payment.paidAmount,
          paymentMethod: input.paymentMethod ?? "CASH",
        });
      }

      await applyCustomerDebtFromDocument(
        tx,
        sale.customerId,
        total,
        payment.paidAmount
      );

      return converted;
    });

    return {
      ok: true as const,
      sale: updatedSale,
    };
  } catch (error) {
    if (error instanceof SaleStockValidationError) {
      return {
        ok: false as const,
        status: 400,
        message: error.message,
      };
    }

    throw error;
  }
}

async function cancelQuote(ctx: TestContext, saleId: string) {
  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      companyId: ctx.companyId,
    },
  });

  if (!sale) {
    return {
      ok: false as const,
      status: 404,
      message: "Teklif bulunamadı.",
    };
  }

  if (!isQuoteSaleStatus(sale.status)) {
    if (sale.status === "CANCELLED") {
      return {
        ok: false as const,
        status: 400,
        message: "Bu teklif zaten iptal edilmiş.",
      };
    }

    return {
      ok: false as const,
      status: 400,
      message: "Sadece taslak teklifler iptal edilebilir.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: "CANCELLED",
      },
    });
  });

  return {
    ok: true as const,
    message: "Teklif iptal edildi.",
  };
}

async function updateQuote(
  ctx: TestContext,
  saleId: string,
  input: {
    customerId?: string;
    note?: string;
    items: QuoteItemInput[];
  }
) {
  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      companyId: ctx.companyId,
    },
  });

  if (!sale) {
    return {
      ok: false as const,
      status: 404,
      message: "Teklif bulunamadı.",
    };
  }

  if (!isQuoteSaleStatus(sale.status)) {
    return {
      ok: false as const,
      status: 400,
      message: "Sadece taslak teklifler düzenlenebilir.",
    };
  }

  const { customerId, note, items } = input;
  const { subtotal, vatTotal, total } = calcTotals(items);

  await db.$transaction(async (tx) => {
    await tx.saleItem.deleteMany({
      where: { saleId: sale.id },
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        customerId: customerId || null,
        note: note ?? null,
        subtotal,
        vatTotal,
        total,
        paymentStatus: "UNPAID",
        paidAmount: 0,
        items: {
          create: items.map((item) => ({
            productId: item.productId || null,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
    });
  });

  return {
    ok: true as const,
  };
}

function buildQuoteItem(
  ctx: TestContext,
  quantity: number,
  unitPrice = 100,
  vatRate = 20
): QuoteItemInput {
  return {
    productId: ctx.productId,
    name: TEST_PRODUCT_NAME,
    quantity,
    unitPrice,
    vatRate,
  };
}

async function main() {
  console.log("Teklif akış testleri başlıyor...\n");

  const ctx = await setupTestContext();

  try {
    const quoteItems = [buildQuoteItem(ctx, 2)];
    const quoteTotal = calcTotals(quoteItems).total;

    const quote = await createQuote(ctx, quoteItems);
    assertEqual("Teklif status", quote.status, "DRAFT");
    assertStartsWith("Teklif saleNo", quote.saleNo, "T-");
    assertEqual("Teklif sonrası stok", await getProductStock(ctx.productId), 10);
    assertEqual(
      "Teklif sonrası customer.balance",
      await getCustomerBalance(ctx.customerId),
      0
    );
    assertEqual(
      "Teklif sonrası account.balance",
      await getAccountBalance(ctx.accountId),
      0
    );
    console.log("✅ Teklif oluşturuldu");

    const editQuoteItems = [buildQuoteItem(ctx, 2)];
    const editQuote = await createQuote(ctx, editQuoteItems, "Düzenleme testi");
    const stockBeforeEdit = await getProductStock(ctx.productId);
    const balanceBeforeEdit = await getCustomerBalance(ctx.customerId);
    const accountBeforeEdit = await getAccountBalance(ctx.accountId);
    const updatedEditItems = [buildQuoteItem(ctx, 3, 100, 20)];
    const updatedEditTotal = calcTotals(updatedEditItems).total;

    const editResult = await updateQuote(ctx, editQuote.id, {
      customerId: ctx.customerId,
      note: "Güncellendi",
      items: updatedEditItems,
    });

    if (!editResult.ok) {
      throw new Error("Teklif düzenleme başarısız.");
    }

    const editedSnapshot = await getSaleSnapshot(editQuote.id);
    assertEqual("Düzenleme status", editedSnapshot.status, "DRAFT");
    assertEqual("Düzenleme total", Number(editedSnapshot.total), updatedEditTotal);
    assertEqual("Düzenleme paidAmount", Number(editedSnapshot.paidAmount), 0);
    assertEqual("Düzenleme paymentStatus", editedSnapshot.paymentStatus, "UNPAID");
    assertEqual("Düzenleme sonrası stok", await getProductStock(ctx.productId), stockBeforeEdit);
    assertEqual(
      "Düzenleme sonrası customer.balance",
      await getCustomerBalance(ctx.customerId),
      balanceBeforeEdit
    );
    assertEqual(
      "Düzenleme sonrası account.balance",
      await getAccountBalance(ctx.accountId),
      accountBeforeEdit
    );
    console.log("✅ Teklif düzenleme geçti");

    const unpaidConvert = await convertQuote(ctx, quote.id, {
      paymentStatus: "UNPAID",
    });

    if (!unpaidConvert.ok) {
      throw new Error(`UNPAID dönüşüm başarısız: ${unpaidConvert.message}`);
    }

    const unpaidSale = await getSaleSnapshot(quote.id);
    assertEqual("UNPAID status", unpaidSale.status, "COMPLETED");
    assertStartsWith("UNPAID saleNo", unpaidSale.saleNo, "S-");
    assertEqual("UNPAID stok", await getProductStock(ctx.productId), 8);
    assertEqual(
      "UNPAID customer.balance",
      await getCustomerBalance(ctx.customerId),
      quoteTotal
    );
    assertEqual("UNPAID paidAmount", Number(unpaidSale.paidAmount), 0);
    assertEqual("UNPAID paymentStatus", unpaidSale.paymentStatus, "UNPAID");
    console.log("✅ UNPAID dönüşüm geçti");

    const paidItems = [buildQuoteItem(ctx, 1)];
    const paidTotal = calcTotals(paidItems).total;
    const balanceBeforePaid = await getCustomerBalance(ctx.customerId);
    const accountBeforePaid = await getAccountBalance(ctx.accountId);

    const paidQuote = await createQuote(ctx, paidItems);
    const paidConvert = await convertQuote(ctx, paidQuote.id, {
      paymentStatus: "PAID",
    });

    if (!paidConvert.ok) {
      throw new Error(`PAID dönüşüm başarısız: ${paidConvert.message}`);
    }

    const paidSale = await getSaleSnapshot(paidQuote.id);
    assertEqual("PAID stok", await getProductStock(ctx.productId), 7);
    assertEqual(
      "PAID customer.balance",
      await getCustomerBalance(ctx.customerId),
      balanceBeforePaid
    );
    assertEqual("PAID paidAmount", Number(paidSale.paidAmount), paidTotal);
    assertEqual(
      "PAID account.balance",
      await getAccountBalance(ctx.accountId),
      accountBeforePaid + paidTotal
    );
    assertEqual("PAID paymentStatus", paidSale.paymentStatus, "PAID");
    console.log("✅ PAID dönüşüm geçti");

    const partialItems = [buildQuoteItem(ctx, 1)];
    const partialTotal = calcTotals(partialItems).total;
    const collectedAmount = 50;
    const balanceBeforePartial = await getCustomerBalance(ctx.customerId);
    const accountBeforePartial = await getAccountBalance(ctx.accountId);

    const partialQuote = await createQuote(ctx, partialItems);
    const partialConvert = await convertQuote(ctx, partialQuote.id, {
      paymentStatus: "PARTIAL",
      collectedAmount,
    });

    if (!partialConvert.ok) {
      throw new Error(`PARTIAL dönüşüm başarısız: ${partialConvert.message}`);
    }

    const partialSale = await getSaleSnapshot(partialQuote.id);
    assertEqual(
      "PARTIAL paidAmount",
      Number(partialSale.paidAmount),
      collectedAmount
    );
    assertEqual(
      "PARTIAL customer.balance",
      await getCustomerBalance(ctx.customerId),
      balanceBeforePartial + (partialTotal - collectedAmount)
    );
    assertEqual(
      "PARTIAL account.balance",
      await getAccountBalance(ctx.accountId),
      accountBeforePartial + collectedAmount
    );
    assertEqual("PARTIAL paymentStatus", partialSale.paymentStatus, "PARTIAL");
    console.log("✅ PARTIAL dönüşüm geçti");

    const balanceBeforeInsufficient = await getCustomerBalance(ctx.customerId);

    await db.product.update({
      where: { id: ctx.productId },
      data: { stock: 1 },
    });

    const insufficientItems = [buildQuoteItem(ctx, 5)];
    const insufficientQuote = await createQuote(ctx, insufficientItems);
    const insufficientConvert = await convertQuote(ctx, insufficientQuote.id, {
      paymentStatus: "UNPAID",
    });

    assertTrue(
      "Stok yetersiz dönüşüm başarısız olmalı",
      !insufficientConvert.ok
    );

    if (!insufficientConvert.ok) {
      assertTrue(
        "Stok yetersiz mesajı",
        insufficientConvert.message.includes("yeterli stok yok")
      );
    }

    const insufficientSnapshot = await getSaleSnapshot(insufficientQuote.id);
    assertEqual("Stok yetersiz status", insufficientSnapshot.status, "DRAFT");
    assertEqual("Stok yetersiz stok", await getProductStock(ctx.productId), 1);
    assertEqual(
      "Stok yetersiz customer.balance",
      await getCustomerBalance(ctx.customerId),
      balanceBeforeInsufficient
    );
    console.log("✅ Stok yetersizliği engellendi");

    await db.product.update({
      where: { id: ctx.productId },
      data: { stock: 10 },
    });

    const cancelItems = [buildQuoteItem(ctx, 1)];
    const balanceBeforeCancel = await getCustomerBalance(ctx.customerId);
    const accountBeforeCancel = await getAccountBalance(ctx.accountId);
    const stockBeforeCancel = await getProductStock(ctx.productId);

    const cancelQuoteRecord = await createQuote(ctx, cancelItems);
    const cancelResult = await cancelQuote(ctx, cancelQuoteRecord.id);

    if (!cancelResult.ok) {
      throw new Error(`İptal başarısız: ${cancelResult.message}`);
    }

    const cancelledSnapshot = await getSaleSnapshot(cancelQuoteRecord.id);
    assertEqual("İptal status", cancelledSnapshot.status, "CANCELLED");
    assertEqual("İptal sonrası stok", await getProductStock(ctx.productId), stockBeforeCancel);
    assertEqual(
      "İptal sonrası customer.balance",
      await getCustomerBalance(ctx.customerId),
      balanceBeforeCancel
    );
    assertEqual(
      "İptal sonrası account.balance",
      await getAccountBalance(ctx.accountId),
      accountBeforeCancel
    );
    console.log("✅ İptal testi geçti");

    const doubleCancel = await cancelQuote(ctx, cancelQuoteRecord.id);
    assertTrue("Çift iptal engellendi", !doubleCancel.ok);

    if (!doubleCancel.ok) {
      assertEqual(
        "Çift iptal mesajı",
        doubleCancel.message,
        "Bu teklif zaten iptal edilmiş."
      );
    }

    console.log("✅ Çift iptal engeli geçti");

    const completedConvert = await convertQuote(ctx, quote.id, {
      paymentStatus: "UNPAID",
    });

    assertTrue("COMPLETED tekrar convert edilemez", !completedConvert.ok);

    if (!completedConvert.ok) {
      assertEqual(
        "COMPLETED convert mesajı",
        completedConvert.message,
        "Sadece taslak teklifler satışa dönüştürülebilir."
      );
    }

    console.log("✅ COMPLETED convert engeli geçti");

    const completedEdit = await updateQuote(ctx, quote.id, {
      items: [buildQuoteItem(ctx, 1)],
    });

    assertTrue("COMPLETED teklif düzenlenemez", !completedEdit.ok);

    if (!completedEdit.ok) {
      assertEqual(
        "COMPLETED edit mesajı",
        completedEdit.message,
        "Sadece taslak teklifler düzenlenebilir."
      );
    }

    console.log("✅ COMPLETED edit engeli geçti");

    const cancelledEdit = await updateQuote(ctx, cancelQuoteRecord.id, {
      items: [buildQuoteItem(ctx, 1)],
    });

    assertTrue("CANCELLED teklif düzenlenemez", !cancelledEdit.ok);

    if (!cancelledEdit.ok) {
      assertEqual(
        "CANCELLED edit mesajı",
        cancelledEdit.message,
        "Sadece taslak teklifler düzenlenebilir."
      );
    }

    console.log("✅ CANCELLED edit engeli geçti");

    console.log("\nTüm teklif akış testleri geçti.");
  } finally {
    await cleanupTestCompany();
    console.log("\nTest verileri temizlendi.");
  }
}

main()
  .catch((error) => {
    console.error("\nTest başarısız:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
