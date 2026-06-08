import bcrypt from "bcryptjs";
import { db } from "../lib/prisma";
import {
  applyCustomerCollection,
  applyCustomerDebtFromDocument,
  recalculateCustomerBalances,
} from "../lib/customer-balance-utils";
import { createExpenseRecord } from "../lib/expense-service";
import { collectInvoicePayment } from "../lib/invoice-service";
import { buildInvoiceCollectionTitle } from "../lib/invoice-payment-utils";
import { generateInvoiceNo, getMockGibMeta } from "../lib/invoices/mock-gib";
import { generateQuoteNo, generateSaleNo } from "../lib/sale-number-utils";
import {
  recordSaleCollection,
  resolveSalePayment,
  roundMoney,
  type SalePaymentMethod,
} from "../lib/sale-payment-utils";
import {
  applySaleStockDecrement,
  validateSaleItemsStock,
} from "../lib/sale-stock-utils";
import { applyProductStockMovement } from "../lib/stock-movement-service";
import {
  moveStockBetweenWarehouses,
  syncProductTotalStock,
} from "../lib/warehouse-service";

const DEMO_TAX_NO = "DEMO-9988776655";
const DEMO_COMPANY_NAME = "Örnek Ticaret Ltd. Şti.";
const DEMO_COMPANY_EMAIL = "info@ornek-ticaret-demo.com";
const DEMO_SKU_PREFIX = "DEMO-";
const DEMO_PASSWORD = "123456";

const DEMO_USERS = [
  { name: "Demo Sahip", email: "owner@demo.com", role: "OWNER" as const, isOwner: true },
  {
    name: "Demo Muhasebe",
    email: "muhasebe@demo.com",
    role: "ACCOUNTANT" as const,
    isOwner: false,
  },
  { name: "Demo Personel", email: "personel@demo.com", role: "STAFF" as const, isOwner: false },
];

const SUPER_ADMIN_EMAIL = "superadmin@hesapisleri.com";

type DemoContext = {
  companyId: string;
  ownerUserId: string;
  staffUserId: string;
  customerIds: string[];
  productIds: Array<{ id: string; name: string; sellPrice: number; vatRate: number }>;
  cashAccountId: string;
  bankAccountIds: string[];
  accountIds: string[];
  warehouseIds: {
    main: string;
    center: string;
    store: string;
  };
};

type SaleItemInput = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function daysAgo(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, randomInt(0, 59), 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function calcTotals(items: SaleItemInput[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const vatTotal = items.reduce((sum, item) => {
    const line = item.quantity * item.unitPrice;
    return sum + (line * item.vatRate) / 100;
  }, 0);

  return {
    subtotal: roundMoney(subtotal),
    vatTotal: roundMoney(vatTotal),
    total: roundMoney(subtotal + vatTotal),
  };
}

async function cleanupDemoData() {
  const demoCompany = await db.company.findFirst({
    where: { taxNo: DEMO_TAX_NO },
    select: { id: true },
  });

  if (demoCompany) {
    await db.company.delete({ where: { id: demoCompany.id } });
    console.log("Eski demo firma verisi temizlendi.");
  }

  await db.user.deleteMany({
    where: {
      email: { in: DEMO_USERS.map((user) => user.email) },
    },
  });
}

async function ensureSuperAdmin(passwordHash: string) {
  const existing = await db.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existing) {
    console.log("Super Admin korundu:", SUPER_ADMIN_EMAIL);
    return existing;
  }

  const created = await db.user.create({
    data: {
      name: "Super Admin",
      email: SUPER_ADMIN_EMAIL,
      password: passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Super Admin oluşturuldu:", SUPER_ADMIN_EMAIL);
  return created;
}

async function createDemoCompany(passwordHash: string): Promise<DemoContext> {
  const owner = await db.user.create({
    data: {
      name: DEMO_USERS[0]!.name,
      email: DEMO_USERS[0]!.email,
      password: passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const accountant = await db.user.create({
    data: {
      name: DEMO_USERS[1]!.name,
      email: DEMO_USERS[1]!.email,
      password: passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const staff = await db.user.create({
    data: {
      name: DEMO_USERS[2]!.name,
      email: DEMO_USERS[2]!.email,
      password: passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const company = await db.company.create({
    data: {
      name: DEMO_COMPANY_NAME,
      taxNo: DEMO_TAX_NO,
      taxOffice: "Şişli Vergi Dairesi",
      phone: "+90 212 555 01 23",
      email: DEMO_COMPANY_EMAIL,
      address: "Maslak Mah. Büyükdere Cad. No:255 Sarıyer / İstanbul",
      status: "ACTIVE",
    },
  });

  await db.companyUser.createMany({
    data: [
      {
        companyId: company.id,
        userId: owner.id,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
      {
        companyId: company.id,
        userId: accountant.id,
        role: "ACCOUNTANT",
        isOwner: false,
        status: "ACTIVE",
      },
      {
        companyId: company.id,
        userId: staff.id,
        role: "STAFF",
        isOwner: false,
        status: "ACTIVE",
      },
    ],
  });

  const now = new Date();

  await db.companySettings.create({
    data: {
      companyId: company.id,
      currency: "TRY",
      defaultVatRate: 20,
      defaultInvoiceType: "E_ARCHIVE",
      invoiceNumberPrefix: "FTR",
      defaultDueDays: 30,
      invoiceNoteTemplate: "Ödeme için teşekkür ederiz.",
      autoCreateCashAccount: true,
      hideInactiveAccounts: false,
      membershipStatus: "ACTIVE",
      monthlyFee: 1499,
      lastPaymentDate: daysAgo(5),
      nextPaymentDate: addDays(now, 25),
      membershipNote: "Demo işletme üyeliği",
    },
  });

  await db.membershipPayment.create({
    data: {
      companyId: company.id,
      periodStart: daysAgo(35),
      periodEnd: addDays(now, 25),
      amount: 1499,
      status: "PAID",
      provider: "DEMO",
      paymentRef: `DEMO-${Date.now()}`,
      paidAt: daysAgo(5),
    },
  });

  const groupNames = ["Genel", "Perakende", "Toptan", "Kurumsal", "Bayi"];
  await db.customerGroup.createMany({
    data: groupNames.map((name, index) => ({
      companyId: company.id,
      name,
      color: ["blue", "green", "orange", "purple", "slate"][index] ?? "blue",
      sortOrder: index + 1,
    })),
  });

  const customerNames = [
    "Atlas Teknoloji A.Ş.",
    "Nova Perakende Ltd.",
    "Mavi Market Zinciri",
    "Güneş Gıda Toptan",
    "Delta İnşaat Malzemeleri",
    "Kuzey Otomotiv",
    "Ege Mobilya",
    "Yıldız Kırtasiye",
    "Pınar Elektrik",
    "Vadi Lojistik",
    "Çınar Tekstil",
    "Lale Kozmetik",
    "Ufuk Medikal",
    "Deniz Turizm",
    "Kaya Hırdavat",
    "Selin Butik",
    "Bora Elektronik",
    "Asya Gıda",
    "Mehmet Yılmaz",
    "Ayşe Demir",
    "Can Öztürk",
    "Zeynep Aydın",
    "Burak Koç",
    "Elif Şahin",
  ];

  const customerIds: string[] = [];

  for (let index = 0; index < customerNames.length; index += 1) {
    const customer = await db.customer.create({
      data: {
        companyId: company.id,
        name: customerNames[index]!,
        phone: `053${randomInt(2, 9)}${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        email: `musteri${index + 1}@demo-musteri.com`,
        taxNo: `${1000000000 + index}`,
        address: `Demo Mah. ${index + 1}. Sok. No:${index + 10} İstanbul`,
        group: pick(groupNames),
        balance: 0,
        status: "ACTIVE",
      },
    });
    customerIds.push(customer.id);
  }

  const categoryNames = [
    "Elektronik",
    "Ofis Ürünleri",
    "Kırtasiye",
    "Sarf Malzeme",
    "Hizmet",
    "Aksesuar",
  ];

  const categories = await Promise.all(
    categoryNames.map((name, index) =>
      db.productCategory.create({
        data: {
          companyId: company.id,
          name,
          sortOrder: index + 1,
          status: "ACTIVE",
        },
      })
    )
  );

  const productCatalog: Array<[
    string,
    string,
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    "PIECE" | "KG" | "METER" | "LITER" | "PACK",
  ]> = [
    ["Elektronik", "DEMO-LAPTOP-01", "Demo Laptop 15\"", "8690001001001", 18500, 14200, 20, 18, 5, "PIECE"],
    ["Elektronik", "DEMO-MONITOR-02", "Demo Monitör 27\"", "8690001001002", 6200, 4700, 20, 24, 8, "PIECE"],
    ["Elektronik", "DEMO-KEYBOARD-03", "Demo Klavye", "8690001001003", 890, 540, 20, 60, 12, "PIECE"],
    ["Elektronik", "DEMO-MOUSE-04", "Demo Mouse", "8690001001004", 420, 250, 20, 85, 15, "PIECE"],
    ["Elektronik", "DEMO-HEADSET-05", "Demo Kulaklık", "8690001001005", 1150, 720, 20, 32, 8, "PIECE"],
    ["Ofis Ürünleri", "DEMO-DESK-06", "Demo Çalışma Masası", "8690001002001", 7800, 5900, 20, 10, 3, "PIECE"],
    ["Ofis Ürünleri", "DEMO-CHAIR-07", "Demo Ofis Koltuğu", "8690001002002", 3400, 2550, 20, 16, 5, "PIECE"],
    ["Ofis Ürünleri", "DEMO-CABINET-08", "Demo Dosya Dolabı", "8690001002003", 5200, 3900, 20, 8, 2, "PIECE"],
    ["Ofis Ürünleri", "DEMO-LAMP-09", "Demo Masa Lambası", "8690001002004", 680, 410, 20, 28, 6, "PIECE"],
    ["Kırtasiye", "DEMO-NOTE-10", "Demo Defter Paketi", "8690001003001", 45, 22, 20, 240, 50, "PACK"],
    ["Kırtasiye", "DEMO-PEN-11", "Demo Tükenmez Kalem", "8690001003002", 18, 8, 20, 500, 80, "PIECE"],
    ["Kırtasiye", "DEMO-FILE-12", "Demo Klasör Seti", "8690001003003", 35, 16, 20, 180, 30, "PACK"],
    ["Kırtasiye", "DEMO-STAPLER-13", "Demo Zımba", "8690001003004", 220, 130, 20, 40, 10, "PIECE"],
    ["Sarf Malzeme", "DEMO-TONER-14", "Demo Toner Kartuş", "8690001004001", 980, 620, 20, 22, 6, "PIECE"],
    ["Sarf Malzeme", "DEMO-PAPER-15", "Demo A4 Kağıt", "8690001004002", 280, 170, 20, 95, 20, "PACK"],
    ["Sarf Malzeme", "DEMO-CLEAN-16", "Demo Temizlik Sıvısı", "8690001004003", 75, 38, 20, 3, 10, "LITER"],
    ["Sarf Malzeme", "DEMO-LABEL-17", "Demo Etiket Rulosu", "8690001004004", 120, 65, 20, 7, 15, "PACK"],
    ["Hizmet", "DEMO-SETUP-18", "Demo Kurulum Hizmeti", "8690001005001", 2500, 0, 20, 999, 0, "PIECE"],
    ["Hizmet", "DEMO-SUPPORT-19", "Demo Destek Paketi", "8690001005002", 1800, 0, 20, 999, 0, "PIECE"],
    ["Hizmet", "DEMO-TRAIN-20", "Demo Eğitim Hizmeti", "8690001005003", 3200, 0, 20, 999, 0, "PIECE"],
    ["Aksesuar", "DEMO-BAG-21", "Demo Laptop Çantası", "8690001006001", 560, 310, 20, 45, 10, "PIECE"],
    ["Aksesuar", "DEMO-CABLE-22", "Demo USB-C Kablo", "8690001006002", 190, 95, 20, 120, 20, "PIECE"],
    ["Aksesuar", "DEMO-HUB-23", "Demo USB Hub", "8690001006003", 740, 430, 20, 26, 6, "PIECE"],
    ["Aksesuar", "DEMO-STAND-24", "Demo Laptop Standı", "8690001006004", 390, 210, 20, 4, 8, "PIECE"],
    ["Elektronik", "DEMO-TABLET-25", "Demo Tablet", "8690001001025", 9800, 7600, 20, 8, 8, "PIECE"],
    ["Elektronik", "DEMO-PHONE-26", "Demo Akıllı Telefon", "8690001001026", 14500, 11200, 20, 6, 6, "PIECE"],
    ["Ofis Ürünleri", "DEMO-WHITEBOARD-27", "Demo Yazı Tahtası", "8690001002027", 2100, 1450, 20, 6, 3, "PIECE"],
    ["Kırtasiye", "DEMO-MARKER-28", "Demo Marker Kalem", "8690001003028", 28, 12, 20, 9, 20, "PIECE"],
    ["Sarf Malzeme", "DEMO-INK-29", "Demo Mürekkep", "8690001004029", 420, 250, 20, 5, 12, "PIECE"],
    ["Aksesuar", "DEMO-ADAPTER-30", "Demo Güç Adaptörü", "8690001006030", 310, 170, 20, 3, 10, "PIECE"],
    ["Elektronik", "DEMO-WEBCAM-31", "Demo Webcam", "8690001001031", 1250, 780, 20, 14, 5, "PIECE"],
    ["Hizmet", "DEMO-INSTALL-32", "Demo Montaj Hizmeti", "8690001005032", 950, 0, 20, 999, 0, "PIECE"],
  ];

  const mainWarehouse = await db.warehouse.create({
    data: {
      companyId: company.id,
      name: "Ana Depo",
      code: "MAIN",
      isDefault: true,
      status: "ACTIVE",
    },
  });

  const centerWarehouse = await db.warehouse.create({
    data: {
      companyId: company.id,
      name: "Merkez Depo",
      code: "CENTER",
      status: "ACTIVE",
    },
  });

  const storeWarehouse = await db.warehouse.create({
    data: {
      companyId: company.id,
      name: "Mağaza Depo",
      code: "STORE",
      status: "ACTIVE",
    },
  });

  const productIds: DemoContext["productIds"] = [];

  for (const row of productCatalog) {
    const [
      categoryName,
      sku,
      productName,
      barcode,
      sell,
      buy,
      vat,
      stock,
      minStock,
      unitType,
    ] = row;
    const category = categories.find((item) => item.name === categoryName);

    const product = await db.product.create({
      data: {
        companyId: company.id,
        categoryId: category?.id,
        name: productName,
        sku,
        barcode,
        description: `${categoryName} demo ürünü`,
        stock: 0,
        minStock,
        unitType,
        warehouseLocation: `Raf-${randomInt(1, 12)}`,
        buyPrice: buy,
        sellPrice: sell,
        vatRate: vat,
        status: "ACTIVE",
      },
    });

    if (stock > 0 && stock < 500) {
      const mainQty = Math.max(1, Math.round(stock * 0.6));
      const centerQty = Math.max(0, Math.round(stock * 0.25));
      const storeQty = Math.max(0, stock - mainQty - centerQty);

      await db.warehouseStock.createMany({
        data: [
          {
            companyId: company.id,
            warehouseId: mainWarehouse.id,
            productId: product.id,
            quantity: mainQty,
          },
          ...(centerQty > 0
            ? [
                {
                  companyId: company.id,
                  warehouseId: centerWarehouse.id,
                  productId: product.id,
                  quantity: centerQty,
                },
              ]
            : []),
          ...(storeQty > 0
            ? [
                {
                  companyId: company.id,
                  warehouseId: storeWarehouse.id,
                  productId: product.id,
                  quantity: storeQty,
                },
              ]
            : []),
        ],
      });

      await db.stockMovement.create({
        data: {
          companyId: company.id,
          productId: product.id,
          warehouseId: mainWarehouse.id,
          type: "IN",
          quantity: mainQty,
          note: "Demo seed başlangıç stoğu (Ana Depo)",
          movementDate: daysAgo(40),
        },
      });

      await syncProductTotalStock(company.id, product.id);
    } else if (stock > 0) {
      await db.warehouseStock.create({
        data: {
          companyId: company.id,
          warehouseId: mainWarehouse.id,
          productId: product.id,
          quantity: stock,
        },
      });

      await db.stockMovement.create({
        data: {
          companyId: company.id,
          productId: product.id,
          warehouseId: mainWarehouse.id,
          type: "IN",
          quantity: stock,
          note: "Demo seed başlangıç stoğu",
          movementDate: daysAgo(40),
        },
      });

      await syncProductTotalStock(company.id, product.id);
    }

    productIds.push({
      id: product.id,
      name: productName,
      sellPrice: sell,
      vatRate: vat,
    });
  }

  const cashAccount = await db.account.create({
    data: {
      companyId: company.id,
      type: "CASH",
      name: "Nakit Kasa",
      balance: 28500,
      currency: "TRY",
      status: "ACTIVE",
    },
  });

  const bankAccounts = await Promise.all(
    [
      { name: "İş Bankası", balance: 128400 },
      { name: "Garanti BBVA", balance: 86450 },
      { name: "VakıfBank", balance: 45200 },
    ].map((item) =>
      db.account.create({
        data: {
          companyId: company.id,
          type: "BANK",
          name: item.name,
          bankName: item.name,
          iban: `TR${randomInt(10, 99)}000100000000000000${randomInt(1000, 9999)}`,
          balance: item.balance,
          currency: "TRY",
          status: "ACTIVE",
        },
      })
    )
  );

  await db.activityLog.create({
    data: {
      companyId: company.id,
      userId: owner.id,
      action: "CREATE",
      module: "company",
      message: "Demo işletme verisi oluşturuldu.",
    },
  });

  return {
    companyId: company.id,
    ownerUserId: owner.id,
    staffUserId: staff.id,
    customerIds,
    productIds,
    cashAccountId: cashAccount.id,
    bankAccountIds: bankAccounts.map((account) => account.id),
    accountIds: [cashAccount.id, ...bankAccounts.map((account) => account.id)],
    warehouseIds: {
      main: mainWarehouse.id,
      center: centerWarehouse.id,
      store: storeWarehouse.id,
    },
  };
}

async function buildSaleItems(ctx: DemoContext, count = randomInt(1, 3)) {
  const items: SaleItemInput[] = [];
  const used = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const available = await db.product.findMany({
      where: {
        companyId: ctx.companyId,
        stock: { gt: 0 },
        id: {
          in: ctx.productIds
            .map((item) => item.id)
            .filter((id) => !used.has(id)),
        },
      },
      select: {
        id: true,
        name: true,
        sellPrice: true,
        vatRate: true,
        stock: true,
      },
    });

    if (available.length === 0) {
      break;
    }

    const product = pick(available);
    used.add(product.id);

    items.push({
      productId: product.id,
      name: product.name,
      quantity: Math.min(randomInt(1, 3), product.stock),
      unitPrice: Number(product.sellPrice),
      vatRate: product.vatRate,
    });
  }

  if (items.length === 0) {
    throw new Error("Satış oluşturmak için yeterli stok bulunamadı.");
  }

  return items;
}

type DemoOrderSeed = {
  sourceChannel?:
    | "MANUAL"
    | "POS"
    | "WEBSITE"
    | "TRENDYOL"
    | "HEPSIBURADA"
    | "N11"
    | "AMAZON"
    | "CICEKSEPETI";
  externalOrderId?: string;
  orderStatus?:
    | "WAITING"
    | "APPROVED"
    | "SHIPPING"
    | "DELIVERED"
    | "RETURN_REQUESTED"
    | "RETURNED"
    | "CANCELLED";
  shippingCarrier?: string;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
};

async function createCompletedSale(
  ctx: DemoContext,
  input: {
    customerId: string | null;
    items: SaleItemInput[];
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
    collectedAmount?: number;
    paymentMethod?: SalePaymentMethod;
    accountId?: string;
    createdAt: Date;
    userId: string;
    order?: DemoOrderSeed;
  }
) {
  const totals = calcTotals(input.items);
  const payment = resolveSalePayment({
    paymentStatus: input.paymentStatus,
    total: totals.total,
    collectedAmount: input.collectedAmount,
  });

  const sale = await db.$transaction(async (tx) => {
    await validateSaleItemsStock(tx, ctx.companyId, input.items);

    const saleNo = generateSaleNo(input.createdAt.getFullYear());

    const created = await tx.sale.create({
      data: {
        companyId: ctx.companyId,
        customerId: input.customerId,
        userId: input.userId,
        saleNo,
        subtotal: totals.subtotal,
        vatTotal: totals.vatTotal,
        discount: 0,
        total: totals.total,
        status: "COMPLETED",
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        sourceChannel: input.order?.sourceChannel ?? "MANUAL",
        externalOrderId: input.order?.externalOrderId ?? null,
        orderStatus: input.order?.orderStatus ?? "APPROVED",
        shippingCarrier: input.order?.shippingCarrier ?? null,
        trackingNumber: input.order?.trackingNumber ?? null,
        shippedAt: input.order?.shippedAt ?? null,
        deliveredAt: input.order?.deliveredAt ?? null,
        createdAt: input.createdAt,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: roundMoney(item.quantity * item.unitPrice),
          })),
        },
      },
    });

    await applySaleStockDecrement(tx, ctx.companyId, saleNo, input.items);

    if (payment.paidAmount > 0) {
      await recordSaleCollection(tx, {
        companyId: ctx.companyId,
        saleNo,
        amount: payment.paidAmount,
        paymentMethod: input.paymentMethod ?? "CASH",
        accountId: input.accountId ?? ctx.cashAccountId,
      });
    }

    await applyCustomerDebtFromDocument(
      tx,
      input.customerId,
      totals.total,
      payment.paidAmount
    );

    return created;
  });

  await db.accountTransaction.updateMany({
    where: {
      accountId: { in: ctx.accountIds },
      title: { contains: sale.saleNo },
    },
    data: { date: input.createdAt },
  });

  return sale;
}

async function createQuotes(ctx: DemoContext) {
  for (let index = 0; index < 8; index += 1) {
    const items = await buildSaleItems(ctx, randomInt(1, 3));
    const totals = calcTotals(items);

    await db.sale.create({
      data: {
        companyId: ctx.companyId,
        customerId: pick(ctx.customerIds),
        userId: ctx.ownerUserId,
        saleNo: generateQuoteNo(),
        subtotal: totals.subtotal,
        vatTotal: totals.vatTotal,
        discount: 0,
        total: totals.total,
        status: "DRAFT",
        sourceChannel: "MANUAL",
        orderStatus: "WAITING",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        createdAt: daysAgo(randomInt(1, 20)),
        note: "Demo teklif kaydı",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: roundMoney(item.quantity * item.unitPrice),
          })),
        },
      },
    });
  }
}

async function createInvoiceFromSale(
  ctx: DemoContext,
  saleId: string,
  dueDate: Date
) {
  const sale = await db.sale.findFirstOrThrow({
    where: { id: saleId, companyId: ctx.companyId },
  });

  const gib = getMockGibMeta("NORMAL", "SENT");

  return db.invoice.create({
    data: {
      companyId: ctx.companyId,
      customerId: sale.customerId,
      saleId: sale.id,
      invoiceNo: generateInvoiceNo("NORMAL"),
      type: "NORMAL",
      status: "SENT",
      total: sale.total,
      paymentStatus: sale.paymentStatus,
      paidAmount: sale.paidAmount,
      dueDate,
      createdAt: sale.createdAt,
      gibStatus: gib.gibStatus,
      gibMessage: gib.gibMessage,
    },
  });
}

async function createManualInvoice(
  ctx: DemoContext,
  input: {
    customerId: string;
    total: number;
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
    collectedAmount?: number;
    createdAt: Date;
    dueDate: Date;
    accountId?: string;
  }
) {
  const payment = resolveSalePayment({
    paymentStatus: input.paymentStatus,
    total: input.total,
    collectedAmount: input.collectedAmount,
  });
  const gib = getMockGibMeta("E_ARCHIVE", "SENT");

  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        companyId: ctx.companyId,
        customerId: input.customerId,
        invoiceNo: generateInvoiceNo("E_ARCHIVE"),
        type: "E_ARCHIVE",
        status: "SENT",
        total: input.total,
        paymentStatus: payment.paymentStatus,
        paidAmount: payment.paidAmount,
        dueDate: input.dueDate,
        createdAt: input.createdAt,
        gibStatus: gib.gibStatus,
        gibMessage: gib.gibMessage,
      },
    });

    await applyCustomerDebtFromDocument(
      tx,
      input.customerId,
      input.total,
      payment.paidAmount
    );

    if (payment.paidAmount > 0) {
      const account = await tx.account.findFirstOrThrow({
        where: {
          id: input.accountId ?? ctx.cashAccountId,
          companyId: ctx.companyId,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: payment.paidAmount } },
      });

      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          type: "INCOME",
          title: buildInvoiceCollectionTitle(created.invoiceNo),
          amount: payment.paidAmount,
          date: input.createdAt,
          invoiceId: created.id,
          note: `${created.invoiceNo} demo fatura tahsilatı`,
        },
      });
    }

    return created;
  });

  return invoice;
}

async function seedSalesAndInvoices(ctx: DemoContext) {
  const paymentMix: Array<{
    status: "PAID" | "UNPAID" | "PARTIAL";
    collectedAmount?: number;
    method?: SalePaymentMethod;
    accountId?: string;
  }> = [
    { status: "PAID" },
    { status: "PAID", method: "BANK", accountId: ctx.bankAccountIds[0] },
    { status: "UNPAID" },
    { status: "PARTIAL", collectedAmount: 1500 },
    { status: "PAID" },
    { status: "UNPAID" },
    { status: "PARTIAL", collectedAmount: 2500, method: "BANK", accountId: ctx.bankAccountIds[1] },
    { status: "PAID", method: "CASH" },
    { status: "UNPAID" },
    { status: "PAID" },
    { status: "UNPAID" },
    { status: "PARTIAL", collectedAmount: 900 },
    { status: "PAID", method: "BANK", accountId: ctx.bankAccountIds[2] },
    { status: "UNPAID" },
    { status: "PAID" },
    { status: "UNPAID" },
    { status: "PARTIAL", collectedAmount: 3200 },
    { status: "PAID" },
    { status: "UNPAID" },
    { status: "PAID", method: "BANK", accountId: ctx.bankAccountIds[0] },
    { status: "UNPAID" },
    { status: "PAID" },
    { status: "PARTIAL", collectedAmount: 1100 },
    { status: "UNPAID" },
    { status: "PAID" },
  ];

  const createdSales = [];

  const orderMix: DemoOrderSeed[] = [
    { sourceChannel: "MANUAL", orderStatus: "APPROVED" },
    { sourceChannel: "TRENDYOL", externalOrderId: "TY-10001", orderStatus: "SHIPPING", shippingCarrier: "Trendyol Express", trackingNumber: "112233445501", shippedAt: daysAgo(2) },
    { sourceChannel: "HEPSIBURADA", externalOrderId: "HB-20002", orderStatus: "DELIVERED", shippingCarrier: "Hepsijet", trackingNumber: "998877665502", shippedAt: daysAgo(5), deliveredAt: daysAgo(1) },
    { sourceChannel: "N11", externalOrderId: "N11-30003", orderStatus: "WAITING" },
    { sourceChannel: "WEBSITE", orderStatus: "APPROVED" },
    { sourceChannel: "CICEKSEPETI", externalOrderId: "CS-40004", orderStatus: "SHIPPING", shippingCarrier: "Yurtiçi Kargo", trackingNumber: "554433221105", shippedAt: daysAgo(3) },
    { sourceChannel: "AMAZON", externalOrderId: "AMZ-50005", orderStatus: "DELIVERED", shippingCarrier: "Aras Kargo", trackingNumber: "667788990006", shippedAt: daysAgo(7), deliveredAt: daysAgo(2) },
    { sourceChannel: "MANUAL", orderStatus: "RETURN_REQUESTED" },
    { sourceChannel: "TRENDYOL", externalOrderId: "TY-10009", orderStatus: "CANCELLED" },
    { sourceChannel: "POS", orderStatus: "DELIVERED", deliveredAt: daysAgo(1) },
  ];

  for (let index = 0; index < 25; index += 1) {
    const mix = paymentMix[index] ?? { status: "UNPAID" as const };
    const items = await buildSaleItems(ctx, randomInt(1, 4));
    const createdAt = daysAgo(randomInt(0, 29), randomInt(8, 18));
    const orderSeed = orderMix[index % orderMix.length] ?? { sourceChannel: "MANUAL", orderStatus: "APPROVED" };
    const sale = await createCompletedSale(ctx, {
      customerId: pick(ctx.customerIds),
      items,
      paymentStatus: mix.status,
      collectedAmount: mix.collectedAmount,
      paymentMethod: mix.method,
      accountId: mix.accountId,
      createdAt,
      userId: index % 2 === 0 ? ctx.ownerUserId : ctx.staffUserId,
      order: {
        ...orderSeed,
        shippedAt: orderSeed.shippedAt ?? (orderSeed.orderStatus === "SHIPPING" || orderSeed.orderStatus === "DELIVERED" ? daysAgo(4) : undefined),
        deliveredAt: orderSeed.deliveredAt ?? (orderSeed.orderStatus === "DELIVERED" ? daysAgo(1) : undefined),
      },
    });
    createdSales.push(sale);
  }

  const invoiceSales = createdSales.slice(0, 10);
  for (const sale of invoiceSales) {
    await createInvoiceFromSale(
      ctx,
      sale.id,
      addDays(sale.createdAt, randomInt(7, 30))
    );
  }

  const manualInvoices = [
    { total: 8400, status: "PAID" as const, days: 12 },
    { total: 12600, status: "UNPAID" as const, days: 8 },
    { total: 5900, status: "PARTIAL" as const, collectedAmount: 2400, days: 18 },
    { total: 4200, status: "UNPAID" as const, days: 3 },
    { total: 9800, status: "PAID" as const, days: 22 },
  ];

  for (const item of manualInvoices) {
    const createdAt = daysAgo(item.days);
    await createManualInvoice(ctx, {
      customerId: pick(ctx.customerIds),
      total: item.total,
      paymentStatus: item.status,
      collectedAmount: item.collectedAmount,
      createdAt,
      dueDate: addDays(createdAt, 15),
      accountId: pick(ctx.accountIds),
    });
  }

  const partialInvoice = await db.invoice.findFirst({
    where: {
      companyId: ctx.companyId,
      paymentStatus: "UNPAID",
      saleId: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (partialInvoice) {
    await collectInvoicePayment({
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      invoiceId: partialInvoice.id,
      data: {
        accountId: ctx.cashAccountId,
        amount: 1200,
        note: "Demo kısmi tahsilat",
      },
    });
  }

  const creditCustomerId = ctx.customerIds[0]!;
  const creditSale = await createCompletedSale(ctx, {
    customerId: creditCustomerId,
    items: await buildSaleItems(ctx, 2),
    paymentStatus: "UNPAID",
    createdAt: daysAgo(6),
    userId: ctx.ownerUserId,
  });

  await db.$transaction(async (tx) => {
    await applyCustomerCollection(tx, creditCustomerId, 5000);
  });

  await db.activityLog.create({
    data: {
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      action: "COLLECT",
      module: "sales",
      message: `${creditSale.saleNo} için demo fazla tahsilat kaydı.`,
    },
  });
}

async function seedExpenses(ctx: DemoContext) {
  const expenses = [
    ["Ofis kirası", "Kira", 18500, "PAID", 28],
    ["İnternet ve telefon", "İnternet", 1450, "PAID", 24],
    ["Google Ads kampanyası", "Reklam", 6200, "PAID", 18],
    ["Araç yakıt gideri", "Ulaşım", 2800, "PAID", 15],
    ["Personel yemek", "Yemek", 3600, "UNPAID", 10],
    ["Kargo ve lojistik", "Ulaşım", 1950, "PAID", 20],
    ["Danışmanlık hizmeti", "Danışmanlık", 7500, "UNPAID", 12],
    ["Elektrik faturası", "Elektrik", 2100, "PAID", 26],
    ["Su faturası", "Su", 680, "PAID", 25],
    ["Bakım onarım", "Bakım", 1450, "UNPAID", 8],
    ["Sigorta ödemesi", "Sigorta", 4200, "PAID", 14],
    ["Ofis malzemeleri", "Ofis", 980, "PAID", 6],
    ["Sosyal medya reklam", "Reklam", 2400, "UNPAID", 4],
    ["Yazılım aboneliği", "Danışmanlık", 1890, "PAID", 16],
    ["Vergi danışmanlığı", "Vergi", 5200, "UNPAID", 2],
  ] as const;

  for (const [title, category, amount, paymentStatus, days] of expenses) {
    const result = await createExpenseRecord({
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      data: {
        title,
        category,
        supplier: "Demo Tedarikçi",
        amount,
        paymentStatus,
        accountId: paymentStatus === "PAID" ? pick(ctx.accountIds) : undefined,
        date: daysAgo(days).toISOString(),
        note: "Demo gider kaydı",
      },
    });

    if (!result.ok) {
      throw new Error(result.message);
    }

    if (paymentStatus === "PAID") {
      await db.expense.update({
        where: { id: result.data.id },
        data: { date: daysAgo(days) },
      });
      await db.accountTransaction.updateMany({
        where: { expenseId: result.data.id },
        data: { date: daysAgo(days) },
      });
    }
  }
}

async function seedWarehouseTransfers(ctx: DemoContext) {
  const products = await db.product.findMany({
    where: {
      companyId: ctx.companyId,
      stock: { gt: 10 },
    },
    take: 5,
    orderBy: { stock: "desc" },
    select: { id: true },
  });

  for (const product of products) {
    const quantity = randomInt(2, 5);
    const result = await moveStockBetweenWarehouses({
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      fromWarehouseId: ctx.warehouseIds.main,
      toWarehouseId: ctx.warehouseIds.store,
      productId: product.id,
      quantity,
      note: "Demo depo transferi",
      transferDate: daysAgo(randomInt(3, 20)).toISOString(),
    });

    if (!result.ok) continue;

    await moveStockBetweenWarehouses({
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      fromWarehouseId: ctx.warehouseIds.main,
      toWarehouseId: ctx.warehouseIds.center,
      productId: product.id,
      quantity: Math.max(1, quantity - 1),
      note: "Demo merkez transferi",
      transferDate: daysAgo(randomInt(1, 10)).toISOString(),
    });
  }
}

async function seedStockMovements(ctx: DemoContext) {
  const samples = await db.product.findMany({
    where: {
      companyId: ctx.companyId,
      stock: { gt: 5 },
    },
    take: 6,
    orderBy: { stock: "desc" },
    select: { id: true, name: true, stock: true },
  });

  for (const product of samples) {
    const type = pick(["IN", "OUT", "COUNT"] as const);
    const quantity =
      type === "COUNT"
        ? randomInt(8, Math.max(10, product.stock - 2))
        : Math.min(randomInt(1, 3), product.stock - 1);

    const result = await applyProductStockMovement({
      companyId: ctx.companyId,
      userId: ctx.staffUserId,
      productId: product.id,
      input: {
        type,
        quantity,
        warehouseId: ctx.warehouseIds.main,
        note: `Demo ${type} hareketi`,
        movementDate: daysAgo(randomInt(2, 15)).toISOString().slice(0, 10),
      },
    });

    if (!result.ok) {
      console.warn(`Stok hareketi atlandı (${product.name}): ${result.message}`);
    }
  }
}

async function seedNotifications(ctx: DemoContext) {
  const companyProducts = await db.product.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, name: true, stock: true, minStock: true },
  });
  const lowStockProduct = companyProducts
    .filter((product) => product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock)[0];

  await db.notification.createMany({
    data: [
      {
        companyId: ctx.companyId,
        userId: ctx.ownerUserId,
        type: "WARNING",
        title: "Düşük stok uyarısı",
        message: lowStockProduct
          ? `${lowStockProduct.name} kritik stok seviyesinde (${lowStockProduct.stock} adet).`
          : "Bazı ürünlerde stok seviyesi düşük.",
      },
      {
        companyId: ctx.companyId,
        userId: ctx.ownerUserId,
        type: "INFO",
        title: "Vadesi yaklaşan fatura",
        message: "3 faturanın vadesi önümüzdeki 7 gün içinde dolacak.",
      },
      {
        companyId: ctx.companyId,
        userId: ctx.ownerUserId,
        type: "ERROR",
        title: "Geciken tahsilat",
        message: "5 müşteride geciken alacak bulunuyor.",
      },
      {
        companyId: ctx.companyId,
        type: "INFO",
        title: "Demo veri yüklendi",
        message: "Örnek Ticaret Ltd. Şti. için demo işletme verileri hazır.",
      },
    ],
  });
}

async function seedCustomerAdvancePayment(ctx: DemoContext) {
  const customerId = ctx.customerIds[ctx.customerIds.length - 1];
  const amount = 2500;

  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: ctx.cashAccountId },
      data: { balance: { increment: amount } },
    });

    await tx.accountTransaction.create({
      data: {
        accountId: ctx.cashAccountId,
        type: "INCOME",
        title: "Müşteri avans ödemesi",
        amount,
        date: daysAgo(3),
        note: "Demo avans tahsilatı — alacaklı müşteri senaryosu",
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: { balance: { decrement: amount } },
    });
  });
}

async function printSummary(companyId: string) {
  const [
    users,
    customers,
    products,
    sales,
    quotes,
    invoices,
    expenses,
    accounts,
    transactions,
    stockMovements,
    notifications,
    logs,
  ] = await Promise.all([
    db.companyUser.count({ where: { companyId } }),
    db.customer.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.sale.count({ where: { companyId, status: "COMPLETED" } }),
    db.sale.count({ where: { companyId, status: "DRAFT" } }),
    db.invoice.count({ where: { companyId } }),
    db.expense.count({ where: { companyId } }),
    db.account.count({ where: { companyId } }),
    db.accountTransaction.count({
      where: { account: { companyId } },
    }),
    db.stockMovement.count({ where: { companyId } }),
    db.notification.count({ where: { companyId } }),
    db.activityLog.count({ where: { companyId } }),
  ]);

  console.log("\n=== Demo Seed Özeti ===");
  console.log(`Firma: 1`);
  console.log(`Kullanıcı: ${users}`);
  console.log(`Müşteri: ${customers}`);
  console.log(`Ürün: ${products}`);
  console.log(`Satış: ${sales}`);
  console.log(`Teklif: ${quotes}`);
  console.log(`Fatura: ${invoices}`);
  console.log(`Gider: ${expenses}`);
  console.log(`Hesap: ${accounts}`);
  console.log(`Kasa/Banka hareketi: ${transactions}`);
  console.log(`Stok hareketi: ${stockMovements}`);
  console.log(`Bildirim: ${notifications}`);
  console.log(`Aktivite log: ${logs}`);
  console.log("\nGiriş bilgileri:");
  console.log("  owner@demo.com / 123456");
  console.log("  muhasebe@demo.com / 123456");
  console.log("  personel@demo.com / 123456");
  console.log("  superadmin@hesapisleri.com / 123456");
}

async function main() {
  console.log("Demo işletme seed başlatılıyor...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await cleanupDemoData();
  await ensureSuperAdmin(passwordHash);

  const ctx = await createDemoCompany(passwordHash);

  await createQuotes(ctx);
  await seedSalesAndInvoices(ctx);
  await seedExpenses(ctx);
  await seedWarehouseTransfers(ctx);
  await seedStockMovements(ctx);
  await seedNotifications(ctx);

  await recalculateCustomerBalances(ctx.companyId);
  await seedCustomerAdvancePayment(ctx);

  await db.activityLog.create({
    data: {
      companyId: ctx.companyId,
      userId: ctx.ownerUserId,
      action: "CREATE",
      module: "admin",
      message: "Demo işletme veri seti yeniden oluşturuldu.",
    },
  });

  await printSummary(ctx.companyId);
  console.log("\nDemo seed tamamlandı.");
}

main()
  .catch((error) => {
    console.error("Demo seed hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
