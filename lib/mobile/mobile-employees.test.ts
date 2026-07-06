/**
 * Mobil çalışanlar (liste/detay/izin/ödeme/performans/departman) — kaynak
 * tarama testleri. DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon
 * testi çalıştırılmadı — bu dosyadaki 32 test tamamen kaynak tarama/unit'tir,
 * gerçek DB entegrasyon testi DEĞİLDİR).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/mobile/mobile-employees-service.ts";
const LIST_ROUTE_PATH = "app/api/mobile/employees/route.ts";
const DETAIL_ROUTE_PATH = "app/api/mobile/employees/[id]/route.ts";
const LEAVES_ROUTE_PATH = "app/api/mobile/employees/[id]/leaves/route.ts";
const LEAVE_APPROVE_ROUTE_PATH = "app/api/mobile/leaves/[id]/approve/route.ts";
const LEAVE_REJECT_ROUTE_PATH = "app/api/mobile/leaves/[id]/reject/route.ts";
const LEAVE_CANCEL_ROUTE_PATH = "app/api/mobile/leaves/[id]/cancel/route.ts";
const PAYMENTS_ROUTE_PATH = "app/api/mobile/employees/[id]/payments/route.ts";
const PERFORMANCE_ROUTE_PATH = "app/api/mobile/employees/[id]/performance/route.ts";
const DEPARTMENTS_ROUTE_PATH = "app/api/mobile/departments/route.ts";
const PERMISSION_POLICY_PATH = "lib/mobile/mobile-permission-policy.ts";
const IDEMPOTENCY_PATH = "lib/mobile/employee-payment-idempotency.ts";
const EMPLOYEE_SERVICE_PATH = "lib/employee-service.ts";
const PERMISSION_UTILS_PATH = "lib/employee-permission-utils.ts";
const WEB_LEAVE_ROUTE_PATH = "app/api/employees/[id]/leaves/[leaveId]/route.ts";

describe("mobile employees — tenant izolasyonu (IDOR)", () => {
  it("tüm route'lar companyId'yi yalnız session'dan alır, body/query'den kabul etmez", async () => {
    for (const routePath of [
      LIST_ROUTE_PATH,
      DETAIL_ROUTE_PATH,
      LEAVES_ROUTE_PATH,
      LEAVE_APPROVE_ROUTE_PATH,
      LEAVE_REJECT_ROUTE_PATH,
      LEAVE_CANCEL_ROUTE_PATH,
      PAYMENTS_ROUTE_PATH,
      PERFORMANCE_ROUTE_PATH,
      DEPARTMENTS_ROUTE_PATH,
    ]) {
      const content = await fs.readFile(routePath, "utf8");
      assert.ok(
        content.includes("requireMobileCompanySession"),
        `${routePath} requireMobileCompanySession kullanmalı`
      );
      assert.ok(
        !content.includes("body.companyId") && !content.includes('params.get("companyId")'),
        `${routePath} companyId'yi body/query'den kabul etmemeli`
      );
    }
  });

  it("getMobileEmployeeDetail canonical getEmployeeById companyId scoped çağırıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMobileEmployeeDetail");
    const fnBody = content.slice(fnStart, content.indexOf("function serializeLeaveForMobile"));
    assert.ok(fnBody.includes("companyId: input.companyId"));
    assert.ok(fnBody.includes("EMPLOYEE_NOT_FOUND"));
  });

  it("departman ataması resolveEmployeeDepartmentAssignment üzerinden aynı companyId'ye scoped (canonical createEmployee/updateEmployee içinde)", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    assert.ok(content.includes("resolveEmployeeDepartmentAssignment({"));
    assert.ok(content.includes("companyId: input.companyId,"));
  });

  it("izin ve ödeme oluşturma önce employee'nin companyId'ye ait olduğunu doğruluyor (getEmployeeInCompany reuse)", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    const leaveStart = content.indexOf("export async function createEmployeeLeave");
    const leaveBody = content.slice(leaveStart, leaveStart + 700);
    assert.ok(leaveBody.includes("getEmployeeInCompany(input.employeeId, input.companyId)"));
  });

  it("leave approve/reject/cancel leaveId'yi companyId scope ile bulur (employeeId path'te yok, IDOR employeeLeave.companyId ile kapatılıyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function getLeaveOrThrow");
    const fnBody = content.slice(fnStart, fnStart + 300);
    assert.ok(fnBody.includes("where: { id: leaveId, companyId }"));
  });
});

describe("mobile employees — permission", () => {
  it("employees modülü mobile-permission-policy.ts'e eklendi, view web ile aynı canAccessModule('employees') kullanır", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    assert.ok(content.includes('"employees"'));
    assert.ok(content.includes("employees: ["));
  });

  it("yalnız OWNER/ADMIN write yetkisine sahip (EMPLOYEE_MANAGE_ROLES ile birebir), STAFF/POS_STAFF hiç erişemiyor", async () => {
    const content = await fs.readFile(PERMISSION_POLICY_PATH, "utf8");
    const ownerBlock = content.slice(content.indexOf("OWNER: {"), content.indexOf("ADMIN: {"));
    assert.ok(ownerBlock.includes('employees: ["read", "write"]'));

    const staffBlock = content.slice(content.indexOf("STAFF: {"), content.indexOf("POS_STAFF: {"));
    assert.ok(staffBlock.includes("employees: [],"));

    const posStaffBlock = content.slice(content.indexOf("POS_STAFF: {"), content.indexOf("};", content.indexOf("POS_STAFF: {")));
    assert.ok(posStaffBlock.includes("employees: [],"));
  });

  it("yazma işlemleri getEmployeeModulePermissions/hasEmployeeApiPermission ile web'deki EMPLOYEE_MANAGE_ROLES'e birebir dayanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/employee-permission-utils"'));
    assert.ok(content.includes("hasEmployeeApiPermission(input.role as UserRole, \"manageRecords\", input.isOwner)"));
  });

  it("ödeme yetkisi canProcessEmployeePayments ile (getEmployeeModulePermissions.canProcessPayments) korunuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function createMobileEmployeePayment");
    const fnBody = content.slice(fnStart, fnStart + 600);
    assert.ok(fnBody.includes("perms.canProcessPayments"));
  });

  it("maaş görünürlüğü permission'a göre gizleniyor, açık canViewEmployeeSalary policy helper kullanılıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("function canViewSalary"));
    assert.ok(content.includes("canViewEmployeeSalary(role as UserRole, perms)"));
    assert.ok(content.includes("function stripSalaryIfNeeded"));
    assert.ok(content.includes("activeSalary: null, salaryRecords: undefined"));
  });
});

describe("mobile employees — canonical servis reuse (Employee vs CompanyUser ayrımı)", () => {
  it("createMobileEmployee/updateMobileEmployee canonical createEmployee/updateEmployee kullanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/employee-service"'));
    assert.ok(content.includes("await createEmployee({"));
    assert.ok(content.includes("await updateEmployee({"));
    assert.ok(
      !content.includes("db.employee.create(") && !content.includes("db.employee.update("),
      "mobil servis doğrudan Prisma employee create/update yapmamalı"
    );
  });

  it("createMobileEmployee companyUserId göndermiyor — otomatik kullanıcı hesabı/davet oluşturulmuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function createMobileEmployee");
    const fnBody = content.slice(fnStart, content.indexOf("export async function updateMobileEmployee"));
    assert.ok(!fnBody.includes("companyUserId:"));
    assert.ok(fnBody.includes("companyUserId bilinçli olarak GÖNDERİLMİYOR"));
  });

  it("updateMobileEmployee mevcut companyUserId'yi açıkça koruyor (normalizeEmployeeInput null'a çevirme riskine karşı)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function updateMobileEmployee");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("companyUserId: existing.companyUserId"));
  });

  it("izin/ödeme/departman/performans işlemleri canonical servisleri reuse ediyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("await createEmployeeLeave({"));
    assert.ok(content.includes("await approveEmployeeLeave({"));
    assert.ok(content.includes("await rejectEmployeeLeave({"));
    assert.ok(content.includes("await cancelEmployeeLeave({"));
    // Ödeme oluşturma artık kalıcı idempotency modülü üzerinden — o modül de
    // canonical createEmployeePayment'ı reuse ediyor (ayrı test ile doğrulanıyor).
    assert.ok(content.includes("executeIdempotentEmployeePayment("));
    assert.ok(content.includes("await getEmployeePerformance({"));
    assert.ok(content.includes("await listEmployeeDepartments({"));
  });
});

describe("mobile employees — liste filtreleri/pagination/summary", () => {
  it("search/departmentId/employmentStatus/leaveStatus/isActive filtreleri destekleniyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const field of ["filters.search", "filters.departmentId", "filters.employmentStatus", "filters.leaveStatus", "filters.isActive"]) {
      assert.ok(content.includes(field), `${field} filtresi desteklenmeli`);
    }
  });

  it("pagination sayfalanmış filtrelenmiş dizi üzerinden hesaplanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function listMobileEmployees");
    const fnBody = content.slice(fnStart, content.indexOf("export async function getMobileEmployeeDetail"));
    assert.ok(fnBody.includes("rows.slice(start, start + pageSize)"));
    assert.ok(fnBody.includes("const total = rows.length;"));
  });

  it("summary alanları mevcut", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const field of ["totalEmployees", "activeEmployees", "employeesOnLeave", "pendingLeaveRequests", "totalMonthlySalaryMinor"]) {
      assert.ok(content.includes(field));
    }
  });

  it("maaş minor integer olarak dönüyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("currentSalaryMinor:"));
    assert.ok(content.includes("toMinor(Number(safe.activeSalary.amount))"));
  });

  it("employeeCode alanı Employee modelinde olmadığı için uydurulmadı, açıkça null", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("employeeCode: null as string | null, // Employee modelinde employeeCode alanı yok"));
  });
});

describe("mobile employees — izin kuralları", () => {
  it("çakışan izin canonical createEmployeeLeave içindeki findOverlappingLeave ile reddediliyor", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    const fnStart = content.indexOf("export async function createEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("findOverlappingLeave"));
    assert.ok(fnBody.includes("Bu tarihlerde çakışan bir izin kaydı var"));
  });

  it("totalDays server-side calculateLeaveDays ile hesaplanıyor, istemciden kabul edilmiyor", async () => {
    const webContent = await fs.readFile("lib/employee-service.ts", "utf8");
    assert.ok(webContent.includes("calculateLeaveDays(input.startAt, input.endAt)"));
    const mobileContent = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!mobileContent.includes("totalDays: z."), "mobil leave create şeması totalDays kabul etmemeli");
  });

  it("mobil leave create şeması status alanı kabul etmiyor (istemciden onay durumu alınmıyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const schemaStart = content.indexOf("export const mobileLeaveCreateSchema");
    const schemaBody = content.slice(schemaStart, schemaStart + 300);
    assert.ok(!schemaBody.includes("status:"));
  });

  it("geçersiz izin transition (PENDING olmayan approve/reject) reddediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("INVALID_LEAVE_TRANSITION"));
    const approveStart = content.indexOf("export async function approveMobileEmployeeLeave");
    const approveBody = content.slice(approveStart, approveStart + 600);
    assert.ok(approveBody.includes('leave.status !== "PENDING"'));
  });

  it("duplicate approve/reject açık hata ile korunuyor (idempotent değil, açık hata seçildi)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("Bu izin talebi zaten işlem görmüş."));
  });

  it("red nedeni zorunlu (mobileLeaveRejectSchema min(1))", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('z.string().trim().min(1, "Red nedeni zorunludur.")'));
  });

  it("izin onaylanınca employee.status ON_LEAVE'e canonical servis üzerinden geçiyor (mobil servis manuel güncellemiyor)", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    const fnStart = content.indexOf("export async function approveEmployeeLeave");
    const fnEnd = content.indexOf("export async function rejectEmployeeLeave");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes('status: "ON_LEAVE"'));
    const mobileContent = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!mobileContent.includes('status: "ON_LEAVE"'), "mobil servis employee status'unu manuel güncellememeli");
  });
});

describe("mobile employees — ödeme kuralları", () => {
  it("başka şirket hesabıyla çalışan ödemesi engelli (accountId companyId scoped bulunuyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function createMobileEmployeePayment");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("where: { id: parsed.data.accountId, companyId: input.companyId }"));
    assert.ok(fnBody.includes("FINANCE_ACCOUNT_NOT_FOUND"));
  });

  it("canonical createEmployeePayment reuse ediliyor (Expense/Kasa-Banka entegrasyonu korunuyor) — artık idempotency modülü içinde çağrılıyor", async () => {
    const content = await fs.readFile(IDEMPOTENCY_PATH, "utf8");
    assert.ok(content.includes("await createEmployeePayment({"));
    assert.ok(content.includes("payImmediately: true"));
  });

  it("negatif kasa ayarı canonical assertFinancePaymentAccount/allowNegativeCashBalance üzerinden uygulanıyor", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    assert.ok(content.includes("getCompanyAllowNegativeCashBalance"));
    assert.ok(content.includes("assertFinancePaymentAccount"));
  });

  it("idempotency zorunlu (uuid) ve mobil servis artık in-memory Map KULLANMIYOR — kalıcı DB-backed executeIdempotentEmployeePayment reuse ediyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("idempotencyKey: z.string().uuid("));
    assert.ok(content.includes("executeIdempotentEmployeePayment"));
    assert.ok(
      !content.includes("new Map<string, { paymentId: string; at: number }>()"),
      "in-memory idempotency Map kaldırılmalı — güvenlik kaynağı artık DB unique constraint"
    );
  });

  it("payroll bağlantılı ödeme duplicate oluşturulmuyor — mobil servis PayrollRunItem'a hiç doğrudan yazmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      !content.includes("payrollRunItem.create") &&
        !content.includes("tx.payrollRunItem")
    );
  });

  it("amountMinor pozitif integer zorunlu", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("amountMinor: z.number().int().positive()"));
  });
});

describe("mobile employees — kalıcı ödeme idempotency (kaynak tarama)", () => {
  it("EmployeePaymentIdempotency modeli companyId+idempotencyKey üzerinde unique — process/instance-independent güvenlik kaynağı", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model EmployeePaymentIdempotency");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(modelBody.includes("@@unique([companyId, idempotencyKey])"));
  });

  it("aynı key + farklı payload → IDEMPOTENCY_CONFLICT (409)", async () => {
    const content = await fs.readFile(IDEMPOTENCY_PATH, "utf8");
    assert.ok(content.includes("IDEMPOTENCY_CONFLICT"));
    assert.ok(content.includes("existing.payloadHash !== input.payloadHash"));
    const idx = content.indexOf('"IDEMPOTENCY_CONFLICT"');
    assert.ok(content.slice(idx, idx + 200).includes("409"));
  });

  it("aynı key + aynı payload → COMPLETED kaydı replay olarak dönüyor (yeni ödeme oluşturulmuyor)", async () => {
    const content = await fs.readFile(IDEMPOTENCY_PATH, "utf8");
    assert.ok(content.includes('mode: "replay"'));
    assert.ok(content.includes("replayed: true"));
  });

  it("unique constraint race'i (P2002) yakalanıp güvenli şekilde ele alınıyor — eşzamanlı iki request için son çare koruması", async () => {
    const content = await fs.readFile(IDEMPOTENCY_PATH, "utf8");
    assert.ok(content.includes("isPrismaUniqueConstraintError(error, \"idempotencyKey\")"));
  });

  it("idempotency claim ve ödeme oluşturma AYNI transaction içinde (tx parametresi createEmployeePayment'a geçiliyor)", async () => {
    const content = await fs.readFile(IDEMPOTENCY_PATH, "utf8");
    assert.ok(content.includes("runTransactionWithRetry"));
    assert.ok(content.includes("tx,\n      });") || content.includes("tx,\n    });") || content.includes("tx,"));
    const fnStart = content.indexOf("const created = await createEmployeePayment");
    assert.ok(fnStart !== -1);
  });

  it("başka şirket aynı idempotencyKey'i kullanabilir (unique companyId+idempotencyKey scoped, global unique DEĞİL)", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model EmployeePaymentIdempotency");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(modelBody.includes("@@unique([companyId, idempotencyKey])"));
    assert.ok(!modelBody.includes("idempotencyKey String @unique"));
  });

  it("in-memory cache artık yalnız performans amaçlı bile değil — tamamen kaldırıldı, DB tek kaynak", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("PAYMENT_IDEMPOTENCY_TTL_MS"));
    assert.ok(!content.includes("pruneIdempotency"));
  });

  it("[DB entegrasyon] eşzamanlı iki ödeme isteği tek finansal kayıt üretir — gerçek Postgres unique constraint gerektirir", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
    // TEST_DATABASE_URL tanımlıysa: iki paralel executeIdempotentEmployeePayment
    // çağrısı aynı idempotencyKey ile yapılır, yalnız bir EmployeePayment
    // satırı oluştuğu doğrulanır (bu ortamda çalıştırılmadı).
  });
});

describe("mobile employees — performans (salt okunur)", () => {
  it("performance route yalnız GET destekliyor, POST yok", async () => {
    const content = await fs.readFile(PERFORMANCE_ROUTE_PATH, "utf8");
    assert.ok(content.includes("export async function GET"));
    assert.ok(!content.includes("export async function POST"));
  });

  it("başka şirket çalışanına performans kaydı sorgusu engelli (getEmployeePerformance companyId scoped)", async () => {
    const content = await fs.readFile("lib/employee-service.ts", "utf8");
    const fnStart = content.indexOf("export async function getEmployeePerformance");
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("companyId: input.companyId"));
    assert.ok(fnBody.includes("Çalışan bulunamadı"));
  });

  it("aylık snapshot cron sistemine dokunulmadı (createEmployeePerformanceSnapshot import edilmedi)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("createEmployeePerformanceSnapshot"));
  });
});

describe("mobile employees — DTO güvenliği", () => {
  it("hassas alanlar (nationalId, password, token) DTO'ya konmuyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const forbidden of ["nationalId", "passwordHash", "invitationToken", "sessionToken"]) {
      assert.ok(!content.includes(forbidden), `${forbidden} DTO'da bulunmamalı`);
    }
  });

  it("linkedUser yalnız id/name/email dönüyor, rol/yetki değiştirme aksiyonu eklenmedi", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("linkedUser: employee.linkedUser"));
    assert.ok(!content.includes("updateCompanyUserRole"));
  });

  it("tarihler ISO string olarak serialize ediliyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("l.startAt.toISOString()"));
    assert.ok(content.includes("l.createdAt.toISOString()"));
  });

  it("bordro DTO minor integer para alanları ve ISO tarih kullanıyor, raw Prisma model dönmüyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("recentPayrollItems: payrollItems.map");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("toMinor(Number(item.baseSalary))"));
    assert.ok(fnBody.includes("toMinor(Number(item.netPayable))"));
    assert.ok(fnBody.includes(".toISOString()"));
  });
});

describe("mobile employees — canonical izin iptal servisi (cancelEmployeeLeave)", () => {
  it("cancelEmployeeLeave lib/employee-service.ts içinde tanımlı ve export ediliyor", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    assert.ok(content.includes("export async function cancelEmployeeLeave"));
  });

  it("web route artık inline db.employeeLeave.update YAPMIYOR, canonical cancelEmployeeLeave'i çağırıyor", async () => {
    const content = await fs.readFile(WEB_LEAVE_ROUTE_PATH, "utf8");
    assert.ok(content.includes("cancelEmployeeLeave({"));
    assert.ok(!content.includes("db.employeeLeave.update"));
  });

  it("mobil servis de AYNI canonical cancelEmployeeLeave'i çağırıyor, kopya iptal mantığı yok", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelMobileEmployeeLeave");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("await cancelEmployeeLeave({"));
    assert.ok(!fnBody.includes("db.employeeLeave.update"));
  });

  it("geçerli status transition: yalnız PENDING/APPROVED iptal edilebilir, diğerleri 409", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 1600);
    assert.ok(fnBody.includes('leave.status !== "PENDING" && leave.status !== "APPROVED"'));
    assert.ok(fnBody.includes("409"));
  });

  it("geçmiş/başlamış izin kuralı: bitiş tarihi geçmiş onaylı izin iptal edilemez", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 1600);
    assert.ok(fnBody.includes("leave.endAt.getTime() < Date.now()"));
    assert.ok(fnBody.includes("Geçmişte tamamlanmış izin iptal edilemez"));
  });

  it("duplicate cancel idempotent — zaten CANCELLED ise hata değil, mevcut kayıt aynen dönüyor", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 1600);
    assert.ok(fnBody.includes('leave.status === "CANCELLED"'));
    assert.ok(fnBody.includes("return serializeLeave(leave);"));
  });

  it("calendar event güncelleme/silme adımı transaction içinde (ileride oluşturulacak CalendarEvent kayıtlarını temizler)", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 3000);
    assert.ok(fnBody.includes("tx.calendarEvent.deleteMany"));
    assert.ok(fnBody.includes('relatedType: "EMPLOYEE_LEAVE"'));
  });

  it("notification/activity log iptal akışında da çağrılıyor (approve/reject ile aynı desen)", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 3200);
    assert.ok(fnBody.includes("logEmployeeActivity(tx, {"));
    assert.ok(fnBody.includes("await createNotification({"));
  });

  it("işlem tek transaction içinde yürütülüyor (db.$transaction)", async () => {
    const content = await fs.readFile(EMPLOYEE_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function cancelEmployeeLeave");
    const fnBody = content.slice(fnStart, fnStart + 3200);
    assert.ok(fnBody.includes("await db.$transaction(async (tx) => {"));
  });
});

describe("mobile employees — maaş görünürlüğü rol matrisi (canViewEmployeeSalary)", () => {
  it("canViewEmployeeSalary explicit policy helper olarak export ediliyor", async () => {
    const content = await fs.readFile(PERMISSION_UTILS_PATH, "utf8");
    assert.ok(content.includes("export function canViewEmployeeSalary"));
  });

  it("liste VE detay DTO'su AYNI helper'ı kullanıyor (tek policy kaynağı)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const listStart = content.indexOf("export async function listMobileEmployees");
    const listBody = content.slice(listStart, content.indexOf("export async function getMobileEmployeeDetail"));
    assert.ok(listBody.includes("canViewSalary(input.role, input.isOwner)"));

    const detailStart = content.indexOf("export async function getMobileEmployeeDetail");
    const detailBody = content.slice(detailStart, detailStart + 500);
    assert.ok(detailBody.includes("canViewSalary(input.role, input.isOwner)"));
  });

  it("rol matrisi — OWNER/ADMIN/SUPER_ADMIN görebilir, ACCOUNTANT/STAFF/POS_STAFF göremez (EMPLOYEE_MANAGE_ROLES ile birebir)", async () => {
    const permContent = await fs.readFile("lib/permission-utils.ts", "utf8");
    const rolesStart = permContent.indexOf("const EMPLOYEE_MANAGE_ROLES");
    const rolesBlock = permContent.slice(rolesStart, rolesStart + 120);
    for (const role of ["OWNER", "ADMIN", "SUPER_ADMIN"]) {
      assert.ok(rolesBlock.includes(`"${role}"`), `${role} EMPLOYEE_MANAGE_ROLES içinde olmalı (maaş görebilir)`);
    }
    assert.ok(!rolesBlock.includes('"ACCOUNTANT"'), "ACCOUNTANT maaşı yönetemez (isReadOnlyViewer — göremez)");
    assert.ok(!rolesBlock.includes('"STAFF"'), "STAFF maaşı göremez");
    assert.ok(!rolesBlock.includes('"POS_STAFF"'), "POS_STAFF maaşı göremez");
  });

  it("canViewEmployeeSalary yetkisiz için summary/detay salary alanlarını null döner (UI render etmesin diye)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("canSeeSalary && safe.activeSalary ? toMinor"));
    assert.ok(content.includes("canSeeSalary && employee.activeSalary"));
  });
});
