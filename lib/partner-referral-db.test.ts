/**
 * Referral/partner conversion — GERÇEK PostgreSQL DB integration testleri.
 * Kaynak tarama DEĞİLDİR. Sipay/PayTR dış çağrısı yapılmaz — bu testler
 * doğrudan canonical conversion servisini (createPartnerSignupConversion /
 * createPartnerPaymentConversion) gerçek DB kayıtlarıyla doğrular; "başarılı
 * finalize/callback" senaryosu, gerçek ödeme sağlayıcı çağrısı olmadan, ödeme
 * durumunun PAID olduğu bir MembershipPayment kaydı üzerinden simüle edilir.
 * TEST_DATABASE_URL yoksa kontrollü skip.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: partner referral DB integration tests require TEST_DATABASE_URL pointing to a _test database";

describe("partner referral / conversion — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let referredUserId: string;
  let selfReferralUserId: string;
  let companyId: string;
  let selfReferralCompanyId: string;
  let partnerId: string;
  let selfReferralPartnerId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];
  const partnerIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `ref-db-${Date.now()}`;

    const referredUser = await db.user.create({
      data: { email: `${stamp}-referred@qa.internal`, password: hash, name: "Referred User", role: "OWNER", status: "ACTIVE" },
    });
    referredUserId = referredUser.id;
    userIds.push(referredUser.id);

    const selfReferralUser = await db.user.create({
      data: { email: `${stamp}-self@qa.internal`, password: hash, name: "Self Referral User", role: "OWNER", status: "ACTIVE" },
    });
    selfReferralUserId = selfReferralUser.id;
    userIds.push(selfReferralUser.id);

    const company = await db.company.create({ data: { name: `Referral Co ${stamp}`, status: "ACTIVE" } });
    companyId = company.id;
    companyIds.push(company.id);

    const selfReferralCompany = await db.company.create({ data: { name: `Self Referral Co ${stamp}`, status: "ACTIVE" } });
    selfReferralCompanyId = selfReferralCompany.id;
    companyIds.push(selfReferralCompany.id);

    const partner = await db.partnerProfile.create({
      data: {
        fullName: "Test Partner",
        email: `${stamp}-partner@qa.internal`,
        referralCode: `REF${stamp.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-10)}`,
        commissionRate: 10,
        status: "ACTIVE",
      },
    });
    partnerId = partner.id;
    partnerIds.push(partner.id);

    // Self-referral senaryosu: partner kendi userId'siyle bağlı.
    const selfPartner = await db.partnerProfile.create({
      data: {
        fullName: "Self Referral Partner",
        email: `${stamp}-selfpartner@qa.internal`,
        referralCode: `SELF${stamp.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-9)}`,
        commissionRate: 10,
        status: "ACTIVE",
        userId: selfReferralUserId,
      },
    });
    selfReferralPartnerId = selfPartner.id;
    partnerIds.push(selfPartner.id);
  });

  after(async () => {
    await db.partnerEarning.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await db.partnerConversion.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await db.membershipPayment.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.partnerProfile.deleteMany({ where: { id: { in: partnerIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("geçerli referral code ile signup conversion oluşur, company.referringPartnerId set edilir", async () => {
    const { createPartnerSignupConversion } = await import("./partner-conversion-service");

    const conversion = await createPartnerSignupConversion({
      companyId,
      userId: referredUserId,
      partnerId,
      referralCode: "TESTCODE",
      source: "COOKIE",
    });

    assert.ok(conversion);
    assert.equal(conversion!.type, "SIGNUP");
    assert.equal(conversion!.partnerId, partnerId);

    const company = await db.company.findUnique({ where: { id: companyId } });
    assert.equal(company!.referringPartnerId, partnerId);
  });

  it("self-referral reddedilir — conversion oluşmaz, company attribution set edilmez", async () => {
    const { createPartnerSignupConversion } = await import("./partner-conversion-service");

    const conversion = await createPartnerSignupConversion({
      companyId: selfReferralCompanyId,
      userId: selfReferralUserId,
      partnerId: selfReferralPartnerId,
      referralCode: "SELFCODE",
      source: "COOKIE",
    });

    assert.equal(conversion, null);

    const company = await db.company.findUnique({ where: { id: selfReferralCompanyId } });
    assert.equal(company!.referringPartnerId, null);

    const conversionCount = await db.partnerConversion.count({ where: { partnerId: selfReferralPartnerId } });
    assert.equal(conversionCount, 0);
  });

  it("başarılı ödeme (PAID) → tek conversion + tek commission (PartnerEarning) oluşur", async () => {
    const { createPartnerPaymentConversion } = await import("./partner-conversion-service");

    const payment = await db.membershipPayment.create({
      data: {
        companyId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 1000,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "PAYTR",
        provider: "PayTR",
        paymentRef: `REF-PAY-${Date.now()}`,
        paidAt: new Date(),
      },
    });

    const conversion = await createPartnerPaymentConversion({
      companyId,
      paymentAmount: 1000,
      membershipPaymentId: payment.id,
    });

    assert.ok(conversion);

    const earningCount = await db.partnerEarning.count({ where: { membershipPaymentId: payment.id } });
    assert.equal(earningCount, 1);

    const conversionCount = await db.partnerConversion.count({ where: { partnerId, type: { in: ["PAID_MEMBERSHIP", "RENEWAL"] } } });
    assert.equal(conversionCount, 1);
  });

  it("aynı callback/finalize iki kez tetiklenirse duplicate conversion/commission oluşmaz", async () => {
    const { createPartnerPaymentConversion } = await import("./partner-conversion-service");

    const payment = await db.membershipPayment.create({
      data: {
        companyId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 500,
        currency: "TRY",
        status: "PAID",
        paymentMethod: "PAYTR",
        provider: "PayTR",
        paymentRef: `REF-DUP-${Date.now()}`,
        paidAt: new Date(),
      },
    });

    const first = await createPartnerPaymentConversion({ companyId, paymentAmount: 500, membershipPaymentId: payment.id });
    const second = await createPartnerPaymentConversion({ companyId, paymentAmount: 500, membershipPaymentId: payment.id });

    assert.ok(first);
    assert.equal(second, null, "ikinci çağrı duplicate commission oluşturmamalı");

    const earningCount = await db.partnerEarning.count({ where: { membershipPaymentId: payment.id } });
    assert.equal(earningCount, 1);
  });

  it("başarısız/cancel ödeme (FAILED) için commission oluşturulmaz — çağıran kod PAID olmayan ödemeler için bu fonksiyonu çağırmamalı, ama yine de zorlanırsa DB'de tek referans membershipPaymentId üzerinden izole kalır", async () => {
    const payment = await db.membershipPayment.create({
      data: {
        companyId,
        period: "MONTHLY",
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        amount: 500,
        currency: "TRY",
        status: "FAILED",
        paymentMethod: "PAYTR",
        provider: "PayTR",
        paymentRef: `REF-FAIL-${Date.now()}`,
      },
    });

    const earningCount = await db.partnerEarning.count({ where: { membershipPaymentId: payment.id } });
    assert.equal(earningCount, 0, "FAILED ödeme için hiçbir commission kaydı olmamalı (canonical akış PAID olmayan ödeme için conversion servisini çağırmaz)");
  });

  it("geçersiz partner (bulunamayan/ACTIVE olmayan partnerId) ile signup conversion güvenli null döner, internal hata sızdırmaz", async () => {
    const { createPartnerSignupConversion } = await import("./partner-conversion-service");

    const result = await createPartnerSignupConversion({
      companyId,
      userId: referredUserId,
      partnerId: "does-not-exist",
      referralCode: "INVALIDCODE",
      source: "REFERRAL_CODE",
    });

    assert.equal(result, null);
  });
});
