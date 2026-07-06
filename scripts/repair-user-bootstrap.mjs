// Eski/bozuk hesaplar için eksik bootstrap kayıtlarını tamamlar.
// Mantık lib/company-bootstrap-service.ts (ensureCompanyBootstrap) ile
// AYNIDIR — bu script Next.js server runtime dışında (plain node) çalıştığı
// için o dosyayı doğrudan import edemez ("server-only" + path alias), bu
// yüzden aynı kontrol/oluşturma adımları burada Prisma ile tekrarlanır.
//
// Kullanım:
//   node scripts/repair-user-bootstrap.mjs --dry-run
//   node scripts/repair-user-bootstrap.mjs --apply
//
// --dry-run: hiçbir yazma yapmaz, yalnız eksikleri raporlar.
// --apply: yalnız eksik kayıtları tamamlar, mevcut veriyi ezmez, tenant
//          scope korunur, idempotent'tir, transaction kullanır.
// Kimlik dogrulama bilgileri veya gizli anahtarlar ASLA loglanmaz.

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isDryRun = args.includes("--dry-run") || !isApply;

if (!isApply && !args.includes("--dry-run")) {
  console.log("Mod belirtilmedi, varsayılan olarak --dry-run çalıştırılıyor.\n");
}

const db = new PrismaClient();

const DEFAULT_MEMBERSHIP_PLAN_CODE = "standard";

async function getDefaultPlan() {
  return db.membershipPlan.findFirst({
    where: { code: DEFAULT_MEMBERSHIP_PLAN_CODE, planStatus: "ACTIVE" },
  });
}

async function analyzeCompany(company) {
  const [ownerCompanyUser, settings, warehouse, account, subscription, onboarding] =
    await Promise.all([
      db.companyUser.findFirst({
        where: { companyId: company.id, isOwner: true },
        select: { id: true, userId: true },
      }),
      db.companySettings.findUnique({ where: { companyId: company.id }, select: { id: true } }),
      db.warehouse.findFirst({
        where: { companyId: company.id, status: "ACTIVE" },
        select: { id: true },
      }),
      db.account.findFirst({
        where: { companyId: company.id, type: "CASH", status: "ACTIVE" },
        select: { id: true },
      }),
      db.companySubscription.findUnique({
        where: { companyId: company.id },
        select: { id: true },
      }),
      db.companyOnboarding.findUnique({
        where: { companyId: company.id },
        select: { id: true },
      }),
    ]);

  const gaps = [];
  if (!ownerCompanyUser) gaps.push("OWNER_MISSING");
  if (!settings) gaps.push("SETTINGS_MISSING");
  if (!warehouse) gaps.push("WAREHOUSE_MISSING");
  if (!account) gaps.push("ACCOUNT_MISSING");
  if (!subscription) gaps.push("SUBSCRIPTION_MISSING");
  if (!onboarding) gaps.push("ONBOARDING_MISSING");

  return { company, gaps, ownerCompanyUser, settings, warehouse, account, subscription, onboarding };
}

async function repairCompany(analysis) {
  const { company, ownerCompanyUser, settings, warehouse, account, subscription, onboarding } =
    analysis;
  const created = [];

  const defaults = {
    currency: "TRY",
    defaultVatRate: 20,
    notifyLowStock: true,
    notifyDueInvoices: true,
    notifyLateCollections: true,
    notifyDailySummary: false,
    notifyEmployeePayments: true,
    trialDays: 14,
  };

  await db.$transaction(async (tx) => {
    if (!ownerCompanyUser) {
      // OWNER'sız company için, o company'ye ait EN ESKİ CompanyUser'ı bulup
      // owner işaretleriz; hiç CompanyUser yoksa atlarız (kullanıcı ilişkisi
      // olmayan company'ye sahte bir user bağlamayız — güvenli davranış).
      const anyMember = await tx.companyUser.findFirst({
        where: { companyId: company.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (anyMember) {
        await tx.companyUser.update({
          where: { id: anyMember.id },
          data: { isOwner: true, role: "OWNER" },
        });
        created.push("OWNER_ASSIGNED");
      } else {
        created.push("OWNER_SKIPPED_NO_MEMBER");
      }
    }

    if (!settings) {
      await tx.companySettings.create({
        data: {
          companyId: company.id,
          currency: defaults.currency,
          defaultVatRate: defaults.defaultVatRate,
          defaultInvoiceType: "E_ARCHIVE",
          invoiceNumberPrefix: "FTR",
          defaultDueDays: 30,
          autoCreateCashAccount: true,
          hideInactiveAccounts: true,
          notifyLowStock: defaults.notifyLowStock,
          notifyDueInvoices: defaults.notifyDueInvoices,
          notifyLateCollections: defaults.notifyLateCollections,
          notifyDailySummary: defaults.notifyDailySummary,
          notifyEmployeePayments: defaults.notifyEmployeePayments,
        },
      });
      created.push("SETTINGS");
    }

    if (!warehouse) {
      const existingDefault = await tx.warehouse.findFirst({
        where: { companyId: company.id, isDefault: true },
        select: { id: true },
      });
      if (!existingDefault) {
        await tx.warehouse.create({
          data: {
            companyId: company.id,
            name: "Ana Depo",
            code: "MAIN",
            isDefault: true,
            status: "ACTIVE",
          },
        });
        created.push("WAREHOUSE");
      }
    }

    if (!account) {
      const existingCash = await tx.account.findFirst({
        where: { companyId: company.id, type: "CASH", status: "ACTIVE" },
        select: { id: true },
      });
      if (!existingCash) {
        await tx.account.create({
          data: {
            companyId: company.id,
            type: "CASH",
            name: "Merkez Kasa",
            balance: 0,
            currency: defaults.currency,
            status: "ACTIVE",
            isDefault: true,
          },
        });
        created.push("ACCOUNT");
      }
    }

    if (!subscription) {
      const plan = await getDefaultPlan();
      if (plan) {
        const now = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + defaults.trialDays);
        await tx.companySubscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status: "TRIAL",
            currentPeriodStart: now,
            currentPeriodEnd: trialEnd,
            trialEndsAt: trialEnd,
          },
        });
        created.push("SUBSCRIPTION");
      } else {
        created.push("SUBSCRIPTION_SKIPPED_NO_PLAN");
      }
    }

    if (!onboarding) {
      await tx.companyOnboarding.upsert({
        where: { companyId: company.id },
        create: { companyId: company.id, status: "NOT_STARTED", currentStep: 1, flowVersion: 1 },
        update: {},
      });
      created.push("ONBOARDING");
    }
  });

  return created;
}

async function main() {
  console.log(`repair-user-bootstrap — mod: ${isApply ? "APPLY" : "DRY-RUN"}\n`);

  const companies = await db.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Toplam aktif şirket: ${companies.length}\n`);

  let brokenCount = 0;
  const brokenSummary = [];

  for (const company of companies) {
    const analysis = await analyzeCompany(company);
    if (analysis.gaps.length === 0) continue;

    brokenCount += 1;
    brokenSummary.push({ companyId: company.id, gaps: analysis.gaps });

    console.log(`[${company.id}] ${company.name} — eksik: ${analysis.gaps.join(", ")}`);

    if (isApply) {
      const created = await repairCompany(analysis);
      console.log(`  → tamamlandı: ${created.length ? created.join(", ") : "(değişiklik yok)"}`);
    }
  }

  console.log("\n--- Özet ---");
  console.log(`Taranan şirket: ${companies.length}`);
  console.log(`Eksik bulunan şirket: ${brokenCount}`);
  if (isDryRun && !isApply) {
    console.log("\nDry-run tamamlandı. Uygulamak için: node scripts/repair-user-bootstrap.mjs --apply");
  } else if (isApply) {
    console.log("\nApply tamamlandı.");
  }
}

main()
  .catch((error) => {
    console.error("REPAIR_SCRIPT_FAILED:", error?.message ?? String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
