/**
 * QA Faz 5E.1 — DB integration (TEST_DATABASE_URL only)
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { getDirectoryPageData } from "@/lib/directory-page-data";
import { buildDirectorySummaryCards } from "@/lib/directory-page-ui-utils";
import { getDirectorySummary } from "@/lib/directory-service";
import {
  getMembershipBillingData,
  resolveUserCompanyEntitlement,
} from "@/lib/membership-service";
import { getSalesPageData } from "@/lib/sales-page-data";
import { getSettingsBundle } from "@/lib/settings-service";
import {
  pickLatestPaidMembershipPayment,
  resolveMembershipPaymentAmount,
} from "@/lib/billing/membership-payment-display";

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl?.includes("_test")) {
  throw new Error("faz-qa-5e-db requires TEST_DATABASE_URL with _test suffix");
}

process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;

const db = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

const stamp = `qa5e-${Date.now()}-${randomUUID().slice(0, 6)}`;
let companyId = "";
let companyBId = "";
let userId = "";
let planId = "";
const registerUserIds: string[] = [];
const registerCompanyIds: string[] = [];

before(async () => {
  const user = await db.user.create({
    data: {
      email: `${stamp}@qa.internal`,
      password: "hash",
      name: "QA 5E",
      role: "OWNER",
      status: "ACTIVE",
      sessionVersion: 1,
      loginTrackingStatus: "NEVER_LOGGED_IN",
    },
  });
  userId = user.id;

  const company = await db.company.create({
    data: { name: `QA5E Co ${stamp}`, status: "ACTIVE" },
  });
  companyId = company.id;

  const companyB = await db.company.create({
    data: { name: `QA5E Co B ${stamp}`, status: "ACTIVE" },
  });
  companyBId = companyB.id;

  await db.companyUser.createMany({
    data: [
      {
        userId,
        companyId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
      {
        userId,
        companyId: companyBId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
    ],
  });

  const plan = await db.membershipPlan.findFirst({
    where: { planStatus: "ACTIVE" },
  });
  if (!plan) {
    throw new Error("QA 5E DB requires at least one ACTIVE membership plan");
  }
  planId = plan.id;

  await db.companySubscription.create({
    data: {
      companyId,
      planId,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
});

after(async () => {
  await db.invoice.deleteMany({
    where: { companyId: { in: [companyId, companyBId] } },
  });
  await db.membershipPayment.deleteMany({
    where: { companyId: { in: [companyId, companyBId] } },
  });
  await db.directoryContact.deleteMany({
    where: { companyId: { in: [companyId, companyBId] } },
  });
  await db.customer.deleteMany({
    where: { companyId: { in: [companyId, companyBId] } },
  });
  await db.companySubscription.deleteMany({
    where: { companyId: { in: [companyId, companyBId, ...registerCompanyIds] } },
  });
  await db.userConsent.deleteMany({
    where: { userId: { in: [userId, ...registerUserIds] } },
  });
  await db.companyUser.deleteMany({
    where: { companyId: { in: [companyId, companyBId, ...registerCompanyIds] } },
  });
  await db.company.deleteMany({
    where: { id: { in: [companyId, companyBId, ...registerCompanyIds] } },
  });
  await db.user.deleteMany({
    where: { id: { in: [userId, ...registerUserIds] } },
  });
  await db.$disconnect();
});

describe("Faz 5E DB — ödeme geçmişi tutar tutarlılığı", () => {
  it("lastPayment.amount tablo satırı ile aynı canonical tutarı gösterir", async () => {
    const paid = await db.membershipPayment.create({
      data: {
        companyId,
        planId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 1799.8,
        amountMinor: 179880,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        provider: "SIPAY",
        paymentRef: `REF-${stamp}`,
        paidAt: new Date(),
      },
    });

    await db.membershipPayment.create({
      data: {
        companyId,
        planId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 1799.8,
        amountMinor: 179880,
        currency: "TRY",
        status: "FAILED",
        paymentMethod: "CREDIT_CARD",
        provider: "SIPAY",
        paymentRef: `REF-FAIL-${stamp}`,
      },
    });

    const billing = await getMembershipBillingData({ companyId, userId });
    assert.ok(billing.lastPayment);
    assert.equal(billing.lastPayment!.id, paid.id);
    assert.equal(billing.lastPayment!.amount, 1798.8);

    const tableRow = billing.payments.find((p) => p.id === paid.id);
    assert.equal(tableRow?.amount, billing.lastPayment!.amount);
    assert.equal(
      resolveMembershipPaymentAmount({ amount: 1799.8, amountMinor: 179880 }),
      1798.8
    );
  });

  it("1499 + %20 KDV canonical tutar 1798,80 TL", async () => {
    assert.equal(
      resolveMembershipPaymentAmount({ amount: 1799.8, amountMinor: 179880 }),
      1798.8
    );
  });

  it("paidAt sıralaması en yeni PAID kaydını seçer", async () => {
    await db.membershipPayment.deleteMany({ where: { companyId } });

    const older = await db.membershipPayment.create({
      data: {
        companyId,
        planId,
        period: "MONTHLY",
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-06-01"),
        amount: 100,
        amountMinor: 10000,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        provider: "SIPAY",
        paymentRef: `REF-OLD-${stamp}`,
        paidAt: new Date("2026-05-15"),
      },
    });

    const newer = await db.membershipPayment.create({
      data: {
        companyId,
        planId,
        period: "MONTHLY",
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-07-01"),
        amount: 200,
        amountMinor: 20000,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        provider: "SIPAY",
        paymentRef: `REF-NEW-${stamp}`,
        paidAt: new Date("2026-06-20"),
      },
    });

    const payments = await db.membershipPayment.findMany({ where: { companyId } });
    const picked = pickLatestPaidMembershipPayment(payments);
    assert.equal(picked?.id, newer.id);
    assert.notEqual(picked?.id, older.id);

    const billing = await getMembershipBillingData({ companyId, userId });
    assert.equal(billing.lastPayment?.id, newer.id);
    assert.equal(billing.lastPayment?.amount, 200);
  });

  it("başka tenant ödemesi dahil edilmez", async () => {
    await db.membershipPayment.create({
      data: {
        companyId: companyBId,
        planId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 9999,
        amountMinor: 999900,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        provider: "SIPAY",
        paymentRef: `REF-OTHER-TENANT-${stamp}`,
        paidAt: new Date(),
      },
    });

    const billing = await getMembershipBillingData({ companyId, userId });
    assert.ok(
      billing.payments.every((payment) => payment.amount !== 9999),
      "Diğer tenant ödemesi listelenmemeli"
    );
  });

  it("shared entitlement kaynağı doğru firma aboneliğini gösterir", async () => {
    await db.companySubscription.deleteMany({ where: { companyId: companyBId } });

    const entitlement = await resolveUserCompanyEntitlement({
      userId,
      companyId: companyBId,
    });

    assert.equal(entitlement.isSharedEntitlement, true);
    assert.equal(entitlement.sourceCompanyId, companyId);
    assert.equal(entitlement.canManageBilling, false);
  });
});

describe("Faz 5E DB — fihrist müşteri sayısı", () => {
  it("crmActiveCustomers, kart ve toplam kayıt tutarlı", async () => {
    await db.customer.createMany({
      data: [
        ...Array.from({ length: 6 }, (_, i) => ({
          companyId,
          name: `Aktif ${i + 1}`,
          status: "ACTIVE" as const,
        })),
        { companyId, name: "Pasif", status: "PASSIVE" },
      ],
    });

    await db.customer.create({
      data: { companyId: companyBId, name: "Diğer Tenant", status: "ACTIVE" },
    });

    await db.directoryContact.createMany({
      data: [
        {
          companyId,
          type: "SUPPLIER",
          sourceType: "MANUAL",
          name: "Tedarikçi QA",
          isActive: true,
        },
        {
          companyId,
          type: "PERSON",
          sourceType: "MANUAL",
          name: "Manuel Kişi",
          isActive: true,
        },
        {
          companyId: companyBId,
          type: "CUSTOMER",
          sourceType: "MANUAL",
          name: "Başka Tenant Fihrist",
          isActive: true,
        },
      ],
    });

    const summary = await getDirectorySummary(companyId);
    assert.equal(summary.crmActiveCustomers, 6);
    assert.equal(summary.suppliers, 1);
    assert.equal(summary.manual, 2);
    assert.equal(summary.total, 2);

    const cards = buildDirectorySummaryCards(summary);
    const customerCard = cards.find((card) => card.key === "customers");
    assert.equal(customerCard?.value, "6");

    const pageData = await getDirectoryPageData({
      companyId,
      status: "active",
    });
    assert.equal(pageData.contacts.length, summary.total);
    assert.equal(pageData.summary.total, pageData.contacts.length);
  });
});

describe("Faz 5E DB — satış fatura kartları", () => {
  it("Toplam/Ortalama Fatura seçili dönem canonical filtresini kullanır", async () => {
    const inPeriod = new Date("2026-07-10T12:00:00+03:00");
    const outPeriod = new Date("2026-06-01T12:00:00+03:00");

    const invoicePayload = [
      {
        companyId,
        invoiceNo: `INV-IN-${stamp}`,
        status: "APPROVED" as const,
        type: "E_INVOICE" as const,
        total: 1000,
        createdAt: inPeriod,
      },
      {
        companyId,
        invoiceNo: `INV-IN2-${stamp}`,
        status: "DRAFT" as const,
        type: "E_ARCHIVE" as const,
        total: 500,
        createdAt: inPeriod,
      },
      {
        companyId,
        invoiceNo: `INV-OUT-${stamp}`,
        status: "APPROVED" as const,
        type: "NORMAL" as const,
        total: 3000,
        createdAt: outPeriod,
      },
      {
        companyId,
        invoiceNo: `INV-CANCEL-${stamp}`,
        status: "CANCELLED" as const,
        type: "NORMAL" as const,
        total: 9000,
        createdAt: inPeriod,
      },
      {
        companyId: companyBId,
        invoiceNo: `INV-OTHER-${stamp}`,
        status: "APPROVED" as const,
        type: "NORMAL" as const,
        total: 7777,
        createdAt: inPeriod,
      },
    ];

    for (const row of invoicePayload) {
      await db.invoice.create({ data: row });
    }

    const salesData = await getSalesPageData(companyId, {
      tab: "invoices",
      page: 1,
      from: new Date("2026-07-01"),
      to: new Date("2026-07-31"),
    });

    const totalCard = salesData.statCards.find((card) => card.title === "Toplam Fatura");
    const averageCard = salesData.statCards.find(
      (card) => card.title === "Ortalama Fatura"
    );

    assert.equal(totalCard?.value, "2");
    assert.equal(averageCard?.value, "₺750,00");
  });
});

describe("Faz 5E DB — kayıt e-postası kalıcılığı", () => {
  it("register akışı gönderilen e-postayı User.email olarak saklar", async () => {
    const email = `register-${stamp}@qa.internal`;
    const password = "QaRegister123!";

    const { registerSchema } = await import("@/lib/auth/register-schema");
    const { hashPassword } = await import("@/lib/auth");
    const { assertRegistrationEnabled, getNewCompanyDefaults } = await import(
      "@/lib/admin/platform-settings"
    );
    const { createCompanyForUser } = await import("@/lib/create-company-service");
    const {
      buildKvkkAcknowledgmentRecord,
      KVKK_AYDINLATMA_VERSION,
    } = await import("@/lib/legal/kvkk-consent");

    await assertRegistrationEnabled();
    const parsed = registerSchema.parse({
      name: "Register QA",
      email,
      password,
      wantsCompanyInfo: true,
      companyName: "QA Register Co",
      kvkkInformed: true,
      marketingConsent: false,
    });

    const hashedPassword = await hashPassword(parsed.password);
    const platformDefaults = await getNewCompanyDefaults();

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.name,
          email: parsed.email,
          password: hashedPassword,
          role: "OWNER",
          status: "ACTIVE",
          loginTrackingStatus: "NEVER_LOGGED_IN",
        },
      });

      await tx.userConsent.create({
        data: {
          userId: user.id,
          type: "KVKK",
          version: KVKK_AYDINLATMA_VERSION,
          consentText: buildKvkkAcknowledgmentRecord(),
          ip: "127.0.0.1",
          userAgent: "qa-5e-db",
        },
      });

      const { company } = await createCompanyForUser(tx, {
        userId: user.id,
        name: parsed.companyName!.trim(),
        email: parsed.email,
        source: "REGISTER",
        registerCompanyNameProvided: true,
        platformDefaults,
      });

      return { user, company };
    });

    registerUserIds.push(result.user.id);
    registerCompanyIds.push(result.company.id);

    assert.equal(result.user.email, email);
    assert.doesNotMatch(result.user.email, /yopmail/i);

    const loaded = await db.user.findUnique({ where: { id: result.user.id } });
    assert.equal(loaded?.email, email);

    const settings = await getSettingsBundle(result.company.id, result.user.id);
    const ownerRow = settings.users.find((row) => row.userId === result.user.id);
    assert.equal(ownerRow?.email, email);

    const bcrypt = (await import("bcryptjs")).default;
    assert.equal(await bcrypt.compare(password, loaded!.password), true);
  });
});

describe("Faz 5E DB — pickLatestPaidMembershipPayment", () => {
  it("FAILED kayıtları atlar", async () => {
    const payments = await db.membershipPayment.findMany({ where: { companyId } });
    const picked = pickLatestPaidMembershipPayment(payments);
    assert.equal(picked?.status, "PAID");
  });
});
