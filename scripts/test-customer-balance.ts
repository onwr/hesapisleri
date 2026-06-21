import { db } from "../lib/prisma";
import {
  applyCustomerCollection,
  applyCustomerDebtFromDocument,
  getCustomerDebtDelta,
  recalculateCustomerBalances,
  reverseCustomerDebtFromDocument,
} from "../lib/customer-balance-utils";
import { roundMoney } from "../lib/sale-payment-utils";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

function assertEqual(label: string, actual: number, expected: number) {
  const a = roundMoney(actual);
  const e = roundMoney(expected);

  if (a !== e) {
    throw new Error(`${label}: beklenen ${e}, gelen ${a}`);
  }

  console.log(`✓ ${label}: ${a}`);
}

async function getBalance(customerId: string) {
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { balance: true },
  });

  return Number(customer.balance);
}

async function main() {
  const company = await db.company.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!company) {
    throw new Error("Test için şirket bulunamadı.");
  }

  const customer = await db.customer.create({
    data: {
      companyId: company.id,
      name: `Bakiye Test ${Date.now()}`,
      balance: 0,
      status: "ACTIVE",
    },
  });

  console.log(`Test müşteri: ${customer.id}`);

  try {
    // A) UNPAID 10.000
    await db.$transaction(async (tx) => {
      await applyCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 0);
    });
    assertEqual("A - UNPAID satış sonrası", await getBalance(customer.id), 10000);

    // B) PAID 10.000 (ek borç yok)
    await db.$transaction(async (tx) => {
      await applyCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 10000);
    });
    assertEqual("B - PAID satış sonrası", await getBalance(customer.id), 10000);

    // C) PARTIAL 10.000 / 4.000 tahsilat
    await db.$transaction(async (tx) => {
      await applyCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 4000);
    });
    assertEqual("C - PARTIAL satış sonrası", await getBalance(customer.id), 16000);

    // D) 2.000 tahsilat
    await db.$transaction(async (tx) => {
      await applyCustomerCollection(tx, company.id, customer.id, 2000);
    });
    assertEqual("D - kısmi tahsilat sonrası", await getBalance(customer.id), 14000);

    // E) 16.000 tahsilat (fazla ödeme)
    await db.$transaction(async (tx) => {
      await applyCustomerCollection(tx, company.id, customer.id, 16000);
    });
    assertEqual("E - fazla tahsilat sonrası", await getBalance(customer.id), -2000);

    // Sıfırla
    await db.customer.update({
      where: { id: customer.id },
      data: { balance: 0 },
    });

    // F) UNPAID iptal simülasyonu
    await db.$transaction(async (tx) => {
      await applyCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 0);
    });
    assertEqual("F1 - UNPAID borç", await getBalance(customer.id), 10000);
    await db.$transaction(async (tx) => {
      await reverseCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 0);
    });
    assertEqual("F2 - UNPAID iptal sonrası", await getBalance(customer.id), 0);

    // G) PARTIAL iptal simülasyonu
    await db.$transaction(async (tx) => {
      await applyCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 4000);
    });
    assertEqual("G1 - PARTIAL kalan borç", await getBalance(customer.id), 6000);
    await db.$transaction(async (tx) => {
      await reverseCustomerDebtFromDocument(tx, company.id, customer.id, 10000, 4000);
    });
    assertEqual("G2 - PARTIAL iptal sonrası", await getBalance(customer.id), 0);

    assertEqual(
      "getCustomerDebtDelta UNPAID",
      getCustomerDebtDelta(10000, 0),
      10000
    );
    assertEqual(
      "getCustomerDebtDelta PAID",
      getCustomerDebtDelta(10000, 10000),
      0
    );
    assertEqual(
      "getCustomerDebtDelta PARTIAL",
      getCustomerDebtDelta(10000, 4000),
      6000
    );

    await recalculateCustomerBalances(company.id);
    console.log("✓ recalculateCustomerBalances çalıştı");

    console.log("\nTüm bakiye testleri geçti.");
  } finally {
    await db.customer.delete({ where: { id: customer.id } });
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
