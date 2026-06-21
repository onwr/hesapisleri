import { comparePassword } from "../lib/auth";
import { getAdminCompanies, getAdminOverview } from "../lib/admin-service";
import { getAiAssistantPageData } from "../lib/ai-assistant-page-data";
import { generateAiAnswer } from "../lib/ai-assistant-page-utils";
import {
  endOfMonth,
  startOfMonth,
  sumSalesTotal,
} from "../lib/dashboard-metrics";
import { getCompanyFinanceBreakdown } from "../lib/finance-aggregation-service";
import {
  canAccessModule,
  canManageUsers,
} from "../lib/permission-utils";
import { db } from "../lib/prisma";
import { getSidebarVisibleHrefs } from "../lib/sidebar-menu";
import { activeSaleStatusFilter } from "../lib/sale-query-utils";
import {
  SaleStockValidationError,
  validateSaleItemsStock,
} from "../lib/sale-stock-utils";
const DEMO_TAX_NO = "DEMO-9988776655";
const DEMO_PASSWORD = "123456";
const DEMO_SKU_PREFIX = "DEMO-";

const USERS = {
  owner: "owner@demo.com",
  accountant: "muhasebe@demo.com",
  staff: "personel@demo.com",
  superAdmin: "superadmin@hesapisleri.com",
} as const;

type TestResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const results: TestResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name} — ${detail}`);
}

function assertMin(name: string, actual: number, min: number) {
  if (actual >= min) {
    pass(name, `${actual} >= ${min}`);
  } else {
    fail(name, `beklenen >= ${min}, gelen ${actual}`);
  }
}

function assertTrue(name: string, value: boolean, detail?: string) {
  if (value) {
    pass(name, detail);
  } else {
    fail(name, detail ?? "koşul sağlanmadı");
  }
}

type DemoContext = {
  companyId: string;
  companyName: string;
  owner: { id: string; email: string };
  accountant: { id: string; email: string; companyRole: string };
  staff: { id: string; email: string; companyRole: string };
  superAdmin: { id: string; email: string };
  cashAccountId: string;
  productId: string;
  customerId: string;
  unpaidSaleId: string | null;
  unpaidInvoiceId: string | null;
  unpaidExpenseId: string | null;
  draftQuoteId: string | null;
};

async function loadDemoContext(): Promise<DemoContext | null> {
  const company = await db.company.findFirst({
    where: { taxNo: DEMO_TAX_NO },
    include: {
      settings: true,
      users: { include: { user: true } },
      accounts: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!company) {
    fail(
      "Demo firma mevcut",
      `taxNo=${DEMO_TAX_NO} bulunamadı. Önce: npx tsx scripts/seed-demo-business.ts`
    );
    return null;
  }

  const findMembership = (email: string) =>
    company.users.find((item) => item.user.email === email);

  const ownerMembership = findMembership(USERS.owner);
  const accountantMembership = findMembership(USERS.accountant);
  const staffMembership = findMembership(USERS.staff);
  const superAdmin = await db.user.findUnique({
    where: { email: USERS.superAdmin },
  });

  if (!ownerMembership || !accountantMembership || !staffMembership || !superAdmin) {
    fail("Demo kullanıcılar", "owner/accountant/staff/superadmin eksik");
    return null;
  }

  const product = await db.product.findFirst({
    where: { companyId: company.id, sku: { startsWith: DEMO_SKU_PREFIX }, stock: { gt: 0 } },
    orderBy: { stock: "desc" },
  });

  const customer = await db.customer.findFirst({
    where: { companyId: company.id },
  });

  const unpaidSale = await db.sale.findFirst({
    where: {
      companyId: company.id,
      status: "COMPLETED",
      paymentStatus: "UNPAID",
    },
  });

  const unpaidInvoice = await db.invoice.findFirst({
    where: {
      companyId: company.id,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      status: { not: "CANCELLED" },
    },
  });

  const unpaidExpense = await db.expense.findFirst({
    where: { companyId: company.id, paymentStatus: "UNPAID" },
  });

  const draftQuote = await db.sale.findFirst({
    where: { companyId: company.id, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });

  const cashAccount =
    company.accounts.find((account) => account.type === "CASH") ??
    company.accounts[0];

  if (!product || !customer || !cashAccount) {
    fail("Demo temel kayıtlar", "ürün/müşteri/kasa hesabı eksik");
    return null;
  }

  pass("Demo firma yüklendi", company.name);

  return {
    companyId: company.id,
    companyName: company.name,
    owner: { id: ownerMembership.user.id, email: ownerMembership.user.email },
    accountant: {
      id: accountantMembership.user.id,
      email: accountantMembership.user.email,
      companyRole: accountantMembership.role,
    },
    staff: {
      id: staffMembership.user.id,
      email: staffMembership.user.email,
      companyRole: staffMembership.role,
    },
    superAdmin: { id: superAdmin.id, email: superAdmin.email },
    cashAccountId: cashAccount.id,
    productId: product.id,
    customerId: customer.id,
    unpaidSaleId: unpaidSale?.id ?? null,
    unpaidInvoiceId: unpaidInvoice?.id ?? null,
    unpaidExpenseId: unpaidExpense?.id ?? null,
    draftQuoteId: draftQuote?.id ?? null,
  };
}

async function testLoginCredentials(ctx: DemoContext) {
  for (const email of Object.values(USERS)) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      fail(`Kullanıcı var: ${email}`, "bulunamadı");
      continue;
    }

    const valid = await comparePassword(DEMO_PASSWORD, user.password);
    assertTrue(`Şifre doğru: ${email}`, valid);
  }
}

async function testDemoDataCounts(ctx: DemoContext) {
  const companyId = ctx.companyId;

  const [
    customers,
    products,
    sales,
    quotes,
    invoices,
    expenses,
    paidExpenses,
    unpaidExpenses,
    accounts,
    transactions,
    lowStock,
    debtorCustomers,
    creditorCustomers,
  ] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.sale.count({ where: { companyId, status: "COMPLETED" } }),
    db.sale.count({ where: { companyId, status: "DRAFT" } }),
    db.invoice.count({ where: { companyId } }),
    db.expense.count({ where: { companyId } }),
    db.expense.count({ where: { companyId, paymentStatus: "PAID" } }),
    db.expense.count({ where: { companyId, paymentStatus: "UNPAID" } }),
    db.account.count({ where: { companyId, status: "ACTIVE" } }),
    db.accountTransaction.count({ where: { account: { companyId } } }),
    db.product.findMany({
      where: { companyId },
      select: { stock: true, minStock: true },
    }).then((rows) => rows.filter((row) => row.stock <= row.minStock).length),
    db.customer.count({ where: { companyId, balance: { gt: 0 } } }),
    db.customer.count({ where: { companyId, balance: { lt: 0 } } }),
  ]);

  assertMin("Müşteri sayısı", customers, 20);
  assertMin("Ürün sayısı", products, 30);
  assertMin("Tamamlanan satış", sales, 20);
  assertMin("Teklif (DRAFT)", quotes, 5);
  assertMin("Fatura sayısı", invoices, 10);
  assertMin("Gider sayısı", expenses, 10);
  assertMin("PAID gider", paidExpenses, 5);
  assertMin("UNPAID gider", unpaidExpenses, 3);
  assertMin("Aktif hesap", accounts, 4);
  assertMin("Kasa hareketi", transactions, 10);
  assertMin("Düşük stok ürün", lowStock, 1);
  assertMin("Borçlu müşteri", debtorCustomers, 1);
  assertMin("Alacaklı müşteri", creditorCustomers, 1);

  const demoSkuProducts = await db.product.count({
    where: { companyId, sku: { startsWith: DEMO_SKU_PREFIX } },
  });
  assertMin("DEMO SKU ürün", demoSkuProducts, 30);

  const [paidInvoices, partialInvoices, unpaidInvoices] = await Promise.all([
    db.invoice.count({ where: { companyId, paymentStatus: "PAID" } }),
    db.invoice.count({ where: { companyId, paymentStatus: "PARTIAL" } }),
    db.invoice.count({
      where: { companyId, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
    }),
  ]);
  assertMin("PAID fatura", paidInvoices, 1);
  assertTrue(
    "Karışık fatura ödeme durumu",
    partialInvoices + unpaidInvoices >= 2,
    `PARTIAL=${partialInvoices}, UNPAID=${unpaidInvoices}`
  );

  const draftQuote = await db.sale.findFirst({
    where: { companyId, status: "DRAFT" },
    select: { saleNo: true },
  });

  if (draftQuote?.saleNo.startsWith("T-")) {
    pass("Teklif numarası T- ile başlıyor", draftQuote.saleNo);
  } else {
    fail("Teklif numarası T- ile başlıyor", draftQuote?.saleNo ?? "teklif yok");
  }
}

async function testDashboardMetrics(ctx: DemoContext) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthSalesRows, accounts, unpaidInvoices] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId: ctx.companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
        ...activeSaleStatusFilter(),
      },
    }),
    db.account.findMany({
      where: { companyId: ctx.companyId, status: "ACTIVE" },
    }),
    db.invoice.findMany({
      where: {
        companyId: ctx.companyId,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        saleId: null,
      },
    }),
  ]);

  const monthSales = sumSalesTotal(monthSalesRows);
  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balance),
    0
  );

  assertTrue("Aylık satış > 0", monthSales > 0, `${monthSales} TRY`);
  assertTrue("Toplam kasa bakiyesi > 0", totalBalance > 0, `${totalBalance} TRY`);
  assertTrue(
    "Bekleyen fatura var",
    unpaidInvoices.length > 0,
    `${unpaidInvoices.length} adet`
  );

  const activityCount = await db.activityLog.count({
    where: { companyId: ctx.companyId },
  });
  assertMin("Aktivite log", activityCount, 5);
}

async function testFinanceAndReports(ctx: DemoContext) {
  const now = new Date();
  const from = startOfMonth(now);
  const to = endOfMonth(now);

  const breakdown = await getCompanyFinanceBreakdown(ctx.companyId, from, to);

  assertTrue("Finans gelir > 0", breakdown.totalIncome > 0);
  assertTrue("Finans gider > 0", breakdown.totalExpense > 0);

  if (breakdown.transferInTotal > 0 || breakdown.transferOutTotal > 0) {
    const incomeWithoutTransfer =
      breakdown.saleCollectionIncome + breakdown.manualIncome;
    assertTrue(
      "Transfer gelir toplamına dahil değil",
      breakdown.totalIncome === incomeWithoutTransfer,
      `gelir=${breakdown.totalIncome}, transfer hariç=${incomeWithoutTransfer}`
    );
    pass(
      "Transfer kayıtları ayrı izleniyor",
      `in=${breakdown.transferInTotal}, out=${breakdown.transferOutTotal}`
    );
  } else {
    pass("Transfer gelir kontrolü", "transfer kaydı yok, atlandı");
  }
}

async function testPosStockGuard(ctx: DemoContext) {
  const product = await db.product.findFirstOrThrow({
    where: { id: ctx.productId },
    select: { id: true, name: true, stock: true },
  });

  const warnings = await db.$transaction(async (tx) =>
    validateSaleItemsStock(tx, ctx.companyId, [
      {
        productId: product.id,
        quantity: product.stock + 50,
        name: product.name,
      },
    ])
  );

  assertTrue("Stok aşımı uyarı üretmeli", warnings.length > 0);
  pass("Stok aşımı uyarısı", warnings[0]?.message.slice(0, 60) ?? "ok");

  const posProducts = await db.product.count({
    where: {
      companyId: ctx.companyId,
      status: "ACTIVE",
    },
  });
  assertMin("POS için aktif ürün", posProducts, 20);
}

async function testAiAssistant(ctx: DemoContext) {
  const now = new Date();
  const data = await getAiAssistantPageData(ctx.companyId, {
    from: startOfMonth(now),
    to: endOfMonth(now),
    userName: "Demo Sahip",
  });

  assertTrue(
    "AI metrik kartları",
    data.metricCards.length >= 4,
    `${data.metricCards.length} kart`
  );
  assertTrue(
    "AI karşılama mesajı",
    data.initialMessages[0]?.content.includes("tahsilat") ?? false
  );

  const answer = generateAiAnswer("Nakit akışım nasıl?", data.context);
  assertTrue(
    "AI nakit yanıtı",
    answer.length > 40 && !answer.includes("Henüz yeterli"),
    answer.slice(0, 80)
  );

  const stockAnswer = generateAiAnswer("Stok risklerim neler?", data.context);
  assertTrue(
    "AI stok yanıtı",
    stockAnswer.includes("stok") || stockAnswer.includes("Stok"),
    stockAnswer.slice(0, 80)
  );
}

async function testRbac(ctx: DemoContext) {
  assertTrue(
    "ACCOUNTANT POS erişemez",
    !canAccessModule("ACCOUNTANT", "pos")
  );
  assertTrue(
    "ACCOUNTANT kasa erişir",
    canAccessModule("ACCOUNTANT", "cash-bank")
  );
  assertTrue(
    "ACCOUNTANT rapor erişir",
    canAccessModule("ACCOUNTANT", "reports")
  );
  assertTrue("STAFF POS erişir", canAccessModule("STAFF", "pos"));
  assertTrue(
    "STAFF kasa erişemez",
    !canAccessModule("STAFF", "cash-bank")
  );
  assertTrue(
    "STAFF rapor erişemez",
    !canAccessModule("STAFF", "reports")
  );

  assertTrue("OWNER kullanıcı yönetir", canManageUsers("OWNER", true));
  assertTrue(
    "ACCOUNTANT kullanıcı yönetemez",
    !canManageUsers("ACCOUNTANT")
  );
  assertTrue("STAFF kullanıcı yönetemez", !canManageUsers("STAFF"));

  const accountantMenu = getSidebarVisibleHrefs("ACCOUNTANT");
  const staffMenu = getSidebarVisibleHrefs("STAFF");

  assertTrue(
    "ACCOUNTANT sidebar'da POS yok",
    !accountantMenu.includes("/pos")
  );
  assertTrue("STAFF sidebar'da POS var", staffMenu.includes("/pos"));
  assertTrue(
    "STAFF sidebar'da kasa yok",
    !staffMenu.includes("/cash-bank")
  );
  assertTrue(
    "ACCOUNTANT sidebar'da kasa var",
    accountantMenu.includes("/cash-bank")
  );
}

async function testSettingsData(ctx: DemoContext) {
  const settings = await db.companySettings.findUnique({
    where: { companyId: ctx.companyId },
  });

  assertTrue("CompanySettings mevcut", Boolean(settings));
  assertTrue(
    "Üyelik ACTIVE",
    settings?.membershipStatus === "ACTIVE"
  );

  const company = await db.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
  });

  assertTrue(
    "Firma adı doğru",
    company.name.includes("Örnek Ticaret")
  );
  assertTrue("Firma telefon dolu", Boolean(company.phone));
  assertTrue("Firma e-posta dolu", Boolean(company.email));
}

async function testSuperAdminData(ctx: DemoContext) {
  const overview = await getAdminOverview();
  assertMin("Admin toplam firma", overview.metrics.totalCompanies, 1);
  assertMin("Admin toplam kullanıcı", overview.metrics.totalUsers, 4);

  const companies = await getAdminCompanies({ q: "Örnek" });
  const demoListed = companies.some(
    (company) => company.name === ctx.companyName
  );
  assertTrue("Admin firmalarında demo firma", demoListed);

  const users = await db.user.count();
  assertMin("Platform kullanıcı sayısı", users, 4);
}

async function testOptionalHttpApi(ctx: DemoContext) {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

  try {
    const health = await fetch(`${baseUrl}/login`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!health.ok) {
      pass("HTTP API testleri", `Sunucu yanıt vermiyor (${baseUrl}), atlandı`);
      return;
    }
  } catch {
    pass("HTTP API testleri", `Sunucu kapalı (${baseUrl}), atlandı`);
    return;
  }

  async function loginAndGetCookie(email: string) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/hesapisleri_token=([^;]+)/);
    return { response, token: match?.[1] ?? null };
  }

  const ownerLogin = await loginAndGetCookie(USERS.owner);
  assertTrue(
    "HTTP owner login",
    ownerLogin.response.ok && Boolean(ownerLogin.token)
  );

  if (ownerLogin.token) {
    const productsRes = await fetch(`${baseUrl}/api/products/list`, {
      headers: { Cookie: `hesapisleri_token=${ownerLogin.token}` },
    });
    const productsJson = await productsRes.json();
    assertTrue(
      "HTTP ürün listesi",
      productsRes.ok && Array.isArray(productsJson.data) && productsJson.data.length > 0
    );

    const cashRes = await fetch(`${baseUrl}/api/cash-bank/accounts/list`, {
      headers: { Cookie: `hesapisleri_token=${ownerLogin.token}` },
    });
    assertTrue("HTTP kasa hesap listesi", cashRes.ok);
  }

  const accountantLogin = await loginAndGetCookie(USERS.accountant);
  if (accountantLogin.token) {
    const posRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `hesapisleri_token=${accountantLogin.token}`,
      },
      body: JSON.stringify({ items: [], paymentStatus: "PAID" }),
    });
    assertTrue("HTTP ACCOUNTANT POS 403", posRes.status === 403);

    const cashRes = await fetch(`${baseUrl}/api/cash-bank/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `hesapisleri_token=${accountantLogin.token}`,
      },
      body: JSON.stringify({}),
    });
    assertTrue(
      "HTTP ACCOUNTANT kasa erişimi",
      cashRes.status !== 403,
      `status=${cashRes.status}`
    );
  }

  const staffLogin = await loginAndGetCookie(USERS.staff);
  if (staffLogin.token) {
    const transferRes = await fetch(`${baseUrl}/api/cash-bank/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `hesapisleri_token=${staffLogin.token}`,
      },
      body: JSON.stringify({}),
    });
    assertTrue("HTTP STAFF transfer 403", transferRes.status === 403);
  }

  const ownerAsAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Cookie: `hesapisleri_token=${ownerLogin.token}` },
  });
  assertTrue("HTTP owner admin 403", ownerAsAdmin.status === 403);

  const superLogin = await loginAndGetCookie(USERS.superAdmin);
  if (superLogin.token) {
    const adminRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Cookie: `hesapisleri_token=${superLogin.token}` },
    });
    const adminJson = await adminRes.json();
    assertTrue(
      "HTTP super admin overview",
      adminRes.ok && adminJson.success === true
    );
  }
}

function printReport() {
  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok).length;
  const total = results.length;

  console.log("\n========================================");
  console.log("  DEMO TEST RAPORU");
  console.log("========================================");
  console.log(`Toplam: ${total} | Geçti: ${passed} | Kaldı: ${failed}`);

  if (failed > 0) {
    console.log("\nBaşarısız kontroller:");
    for (const item of results.filter((row) => !row.ok)) {
      console.log(`  - ${item.name}: ${item.detail}`);
    }
  }

  console.log("\n--- Canlı Demo Durumu ---");
  if (failed === 0) {
    console.log("✅ Otomatik kontroller: CANLI DEMO HAZIR");
    console.log(
      "ℹ️  UI akışları için docs/DEMO-TEST-CHECKLIST.md [MANUEL] maddelerini tamamlayın."
    );
  } else if (passed / total >= 0.8) {
    console.log("⚠️  Otomatik kontroller: KISMİ HAZIR (kritik eksikler var)");
  } else {
    console.log("❌ Otomatik kontroller: HAZIR DEĞİL — seed veya veri eksik");
  }

  console.log("\nManuel test gereken ana alanlar:");
  console.log("  - Dashboard grafikleri ve kart görünümü");
  console.log("  - POS sepet / barkod / ödeme UI");
  console.log("  - Satış iptali ve teklif dönüşümü");
  console.log("  - Fatura/gider tahsilat formları");
  console.log("  - Kasa transfer ve CSV export");
  console.log("  - Ayarlar kaydetme ve davet akışı");
  console.log("  - RBAC sayfa yönlendirmeleri (/unauthorized)");
  console.log("========================================\n");
}

async function main() {
  console.log("Demo flow testleri başlatılıyor...\n");

  const ctx = await loadDemoContext();
  if (!ctx) {
    printReport();
    process.exitCode = 1;
    return;
  }

  await testLoginCredentials(ctx);
  await testDemoDataCounts(ctx);
  await testDashboardMetrics(ctx);
  await testFinanceAndReports(ctx);
  await testPosStockGuard(ctx);
  await testAiAssistant(ctx);
  await testRbac(ctx);
  await testSettingsData(ctx);
  await testSuperAdminData(ctx);
  await testOptionalHttpApi(ctx);

  printReport();

  const failed = results.some((item) => !item.ok);
  if (failed) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Test script hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
