/**
 * Yalnızca demo giriş hesabını oluşturur veya sıfırlar (örnek veri yüklemez).
 *
 * Hesap + ürün, müşteri, satış, fatura vb. tam demo verisi için:
 *   npm run demo:account
 *
 * Varsayılan giriş:
 *   E-posta: owner@demo.com
 *   Şifre:  123456
 */
import { comparePassword, hashPassword } from "../lib/auth";
import { db } from "../lib/prisma";

const DEMO_EMAIL = (process.env.DEMO_EMAIL || "owner@demo.com").trim().toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "123456";
const DEMO_USER_NAME = process.env.DEMO_USER_NAME || "Demo Sahip";
const DEMO_TAX_NO = process.env.DEMO_TAX_NO || "DEMO-9988776655";
const DEMO_COMPANY_NAME = process.env.DEMO_COMPANY_NAME || "Örnek Ticaret Ltd. Şti.";
const DEMO_COMPANY_EMAIL =
  process.env.DEMO_COMPANY_EMAIL || "info@ornek-ticaret-demo.com";

async function ensureDemoCompany() {
  const existing = await db.company.findFirst({
    where: { taxNo: DEMO_TAX_NO },
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      return db.company.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }
    return existing;
  }

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

  await db.companySettings.create({
    data: {
      companyId: company.id,
      currency: "TRY",
      defaultVatRate: 20,
      defaultInvoiceType: "E_ARCHIVE",
      invoiceNumberPrefix: "FTR",
      defaultDueDays: 30,
      membershipStatus: "ACTIVE",
      monthlyFee: 1499,
      nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      membershipNote: "Demo işletme",
    },
  });

  console.log("Demo firma oluşturuldu:", company.name);
  return company;
}

async function ensureDemoUser(passwordHash: string) {
  const existing = await db.user.findUnique({
    where: { email: DEMO_EMAIL },
  });

  if (existing) {
    const updated = await db.user.update({
      where: { id: existing.id },
      data: {
        name: DEMO_USER_NAME,
        password: passwordHash,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    console.log("Demo kullanıcı güncellendi:", DEMO_EMAIL);
    return updated;
  }

  const created = await db.user.create({
    data: {
      name: DEMO_USER_NAME,
      email: DEMO_EMAIL,
      password: passwordHash,
      role: "OWNER",
      status: "ACTIVE",
    },
  });
  console.log("Demo kullanıcı oluşturuldu:", DEMO_EMAIL);
  return created;
}

async function ensureCompanyMembership(companyId: string, userId: string) {
  const existing = await db.companyUser.findUnique({
    where: {
      companyId_userId: { companyId, userId },
    },
  });

  if (existing) {
    if (existing.status !== "ACTIVE" || !existing.isOwner) {
      await db.companyUser.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          role: "OWNER",
          isOwner: true,
        },
      });
      console.log("Firma üyeliği güncellendi.");
    }
    return;
  }

  await db.companyUser.create({
    data: {
      companyId,
      userId,
      role: "OWNER",
      isOwner: true,
      status: "ACTIVE",
    },
  });
  console.log("Firma üyeliği oluşturuldu.");
}

async function main() {
  console.log("Demo giriş hesabı hazırlanıyor...\n");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [company, user] = await Promise.all([
    ensureDemoCompany(),
    ensureDemoUser(passwordHash),
  ]);

  await ensureCompanyMembership(company.id, user.id);

  const passwordOk = await comparePassword(DEMO_PASSWORD, user.password);
  if (!passwordOk) {
    throw new Error("Şifre doğrulaması başarısız.");
  }

  const membership = await db.companyUser.findFirst({
    where: {
      userId: user.id,
      companyId: company.id,
      status: "ACTIVE",
    },
    include: { company: true },
  });

  if (!membership?.company || membership.company.status !== "ACTIVE") {
    throw new Error("Aktif firma üyeliği doğrulanamadı.");
  }

  console.log("\n=== Demo Giriş Hazır ===");
  console.log(`E-posta : ${DEMO_EMAIL}`);
  console.log(`Şifre   : ${DEMO_PASSWORD}`);
  console.log(`Firma   : ${membership.company.name}`);
  console.log(`Firma ID: ${membership.company.id}`);
  console.log("\nTam demo verisi için: npm run seed:demo");
}

main()
  .catch((error) => {
    console.error("Demo hesap oluşturma hatası:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
