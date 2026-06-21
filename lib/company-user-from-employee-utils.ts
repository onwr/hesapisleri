import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { canAccessModule, type AppModule } from "@/lib/permission-utils";

export const USER_PASSWORD_MIN_LENGTH = 8;

export const assignableCompanyUserRoleSchema = z.enum([
  "ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "POS_STAFF",
]);

export const createUserFromEmployeeSchema = z
  .object({
    employeeId: z.string().min(1, "Personel seçmelisiniz."),
    email: z.string().email("E-posta zorunludur."),
    password: z
      .string()
      .min(
        USER_PASSWORD_MIN_LENGTH,
        `Şifre en az ${USER_PASSWORD_MIN_LENGTH} karakter olmalıdır.`
      ),
    passwordConfirm: z.string().min(1, "Şifre tekrarı zorunludur."),
    role: assignableCompanyUserRoleSchema,
    status: z.enum(["ACTIVE", "PASSIVE"]).default("ACTIVE"),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "Şifreler eşleşmiyor.",
    path: ["passwordConfirm"],
  });

export const updateCompanyUserPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        USER_PASSWORD_MIN_LENGTH,
        `Şifre en az ${USER_PASSWORD_MIN_LENGTH} karakter olmalıdır.`
      ),
    passwordConfirm: z.string().min(1, "Şifre tekrarı zorunludur."),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    message: "Şifreler eşleşmiyor.",
    path: ["passwordConfirm"],
  });

export type AssignableCompanyUserRole = z.infer<
  typeof assignableCompanyUserRoleSchema
>;

const ROLE_MODULE_LABELS: Record<AssignableCompanyUserRole, string> = {
  ADMIN: "Yönetici — çoğu modüle erişim",
  ACCOUNTANT: "Muhasebeci — finans, fatura, rapor",
  STAFF: "Personel — satış, müşteri, ürün",
  POS_STAFF: "POS Personeli — yalnızca Hızlı Satış",
};

export function getAssignableRoleOptions() {
  return [
    { value: "ADMIN" as const, label: "Yönetici" },
    { value: "ACCOUNTANT" as const, label: "Muhasebeci" },
    { value: "STAFF" as const, label: "Personel" },
    { value: "POS_STAFF" as const, label: "POS Personeli" },
  ];
}

export function getRoleDescription(role: AssignableCompanyUserRole) {
  return ROLE_MODULE_LABELS[role];
}

const MODULE_LABELS: Partial<Record<AppModule, string>> = {
  dashboard: "Dashboard",
  pos: "Hızlı Satış",
  sales: "Satışlar",
  customers: "Müşteriler",
  suppliers: "Tedarikçiler",
  products: "Ürünler",
  stocks: "Stoklar",
  invoices: "Faturalar",
  "cash-bank": "Kasa & Banka",
  expenses: "Giderler",
  orders: "Siparişler",
  reports: "Raporlar",
  directory: "Fihrist",
  employees: "Çalışanlar",
  "ai-assistant": "AI Asistan",
  calendar: "Takvim",
  settings: "Ayarlar",
  "settings-users": "Kullanıcı Yönetimi",
};

const PREVIEW_MODULES: AppModule[] = [
  "dashboard",
  "pos",
  "sales",
  "customers",
  "suppliers",
  "products",
  "invoices",
  "cash-bank",
  "expenses",
  "reports",
  "directory",
  "employees",
  "settings",
];

export function getRoleModulePreview(role: AssignableCompanyUserRole) {
  return PREVIEW_MODULES.map((module) => ({
    module,
    label: MODULE_LABELS[module] ?? module,
    allowed: canAccessModule(role as UserRole, module, false),
  }));
}

export function validateAssignableRole(role: string):
  | { ok: true; role: AssignableCompanyUserRole }
  | { ok: false; message: string } {
  if (role === "OWNER" || role === "SUPER_ADMIN") {
    return {
      ok: false,
      message: "Bu rol firma içi kullanıcı oluştururken seçilemez.",
    };
  }

  const parsed = assignableCompanyUserRoleSchema.safeParse(role);
  if (!parsed.success) {
    return { ok: false, message: "Rol seçmelisiniz." };
  }

  return { ok: true, role: parsed.data };
}
