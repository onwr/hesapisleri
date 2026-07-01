import { db } from "@/lib/prisma";
import { canAccessModule } from "@/lib/permission-utils";
import { mobileRoleAllows } from "@/lib/mobile/mobile-permission-policy";
import { startOfDay } from "@/lib/dashboard-metrics";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { getSidebarMembershipSummary } from "@/lib/membership-service";
import { getDashboardOnboardingChecklist } from "@/lib/onboarding/onboarding-service";
import { mapActivityLogToDashboardItem } from "@/lib/activity-log-utils";
import { formatRelativeTime } from "@/lib/dashboard-metrics";
import { countLowStockActiveProducts } from "@/lib/stocks-page-utils";
import type { MobileSession } from "./mobile-auth-guards";
import type { UserRole } from "@prisma/client";

export type MobileDashboardSummaryField =
  | { amount: number; count: number; currency: "TRY" }
  | { count: number }
  | null;

export type MobileDashboardQuickAction = {
  key: string;
  label: string;
  route: string;
  hasNativeScreen: boolean;
};

export type MobileDashboardOnboarding = {
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  nextTaskLabel: string | null;
  dismissed: boolean;
  allComplete: boolean;
};

export type MobileDashboardActivity = {
  id: string;
  title: string;
  description: string | null;
  amountLabel: string | null;
  tag: string;
  tagColor: string;
  time: string;
};

export type MobileDashboardResponse = {
  company: {
    id: string;
    name: string;
    role: string;
    isOwner: boolean;
  };
  subscription: {
    status: string;
    planName: string | null;
    trialEndsAt: string | null;
    remainingDays: number | null;
  } | null;
  summary: {
    todaySales: { amount: number; count: number; currency: "TRY" } | null;
    pendingCollection: { amount: number; count: number } | null;
    lowStock: { count: number } | null;
    pendingInvoices: { count: number; amount: number } | null;
  };
  recentActivity: MobileDashboardActivity[];
  quickActions: MobileDashboardQuickAction[];
  onboarding: MobileDashboardOnboarding | null;
};

export async function getMobileDashboard(
  session: MobileSession,
  membership: { company: { id: string; name: string }; role: string; isOwner: boolean }
): Promise<MobileDashboardResponse> {
  const { company, role, isOwner } = membership;
  const companyId = company.id;
  const userRole = role as UserRole;

  const canSales = canAccessModule(userRole, "sales", isOwner);
  const canInvoices = canAccessModule(userRole, "invoices", isOwner);
  const canProducts = canAccessModule(userRole, "stocks", isOwner);

  const todayStart = startOfDay(new Date());

  // Paralel sorgular — yalnız yetkili alanlar
  const [
    todaySalesResult,
    pendingCollectionResult,
    lowStockResult,
    recentActivityResult,
    subscriptionResult,
    onboardingResult,
  ] = await Promise.allSettled([
    canSales
      ? db.sale.findMany({
          where: { companyId, ...activeSaleStatusFilter(), createdAt: { gte: todayStart } },
          select: { total: true },
        })
      : Promise.resolve(null),

    canInvoices
      ? db.invoice.findMany({
          where: { companyId, status: { not: "CANCELLED" }, paymentStatus: { not: "PAID" }, saleId: null },
          select: { total: true, paidAmount: true },
        })
      : Promise.resolve(null),

    canProducts
      ? db.product
          .findMany({
            where: {
              companyId,
              productType: "STOCK",
              status: "ACTIVE",
            },
            select: { stock: true, minStock: true, status: true },
          })
          .then((products) => countLowStockActiveProducts(products))
      : Promise.resolve(null),

    db.activityLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, module: true, message: true, createdAt: true },
    }),

    getSidebarMembershipSummary(companyId).catch(() => null),

    (canAccessModule(userRole, "settings", isOwner)
      ? getDashboardOnboardingChecklist({
          userId: session.userId,
          companyId,
          effectiveRole: role,
          isOwner,
          isSuperAdmin: false,
        })
      : Promise.resolve(null)
    ).catch(() => null),
  ]);

  // Satışlar
  let todaySales: MobileDashboardResponse["summary"]["todaySales"] = null;
  if (canSales && todaySalesResult.status === "fulfilled" && todaySalesResult.value) {
    const rows = todaySalesResult.value as { total: unknown }[];
    const amount = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
    todaySales = { amount, count: rows.length, currency: "TRY" };
  }

  // Tahsilat
  let pendingCollection: MobileDashboardResponse["summary"]["pendingCollection"] = null;
  if (canInvoices && pendingCollectionResult.status === "fulfilled" && pendingCollectionResult.value) {
    const rows = pendingCollectionResult.value as { total: unknown; paidAmount: unknown }[];
    const amount = rows.reduce(
      (s, r) => s + getInvoiceRemainingAmount(Number(r.total ?? 0), Number(r.paidAmount ?? 0)),
      0
    );
    pendingCollection = { amount, count: rows.length };
  }

  // Fatura bekleyen — tahsilattan ayrı (pendingCollection ile aynı sorgu sonucu)
  const pendingInvoices = pendingCollection
    ? { count: pendingCollection.count, amount: pendingCollection.amount }
    : null;

  // Düşük stok
  let lowStock: MobileDashboardResponse["summary"]["lowStock"] = null;
  if (canProducts && lowStockResult.status === "fulfilled" && lowStockResult.value !== null) {
    lowStock = { count: lowStockResult.value as number };
  }

  // Son aktivite — ip, metadata, credential gizle
  const recentActivity: MobileDashboardActivity[] = [];
  if (recentActivityResult.status === "fulfilled") {
    const now = new Date();
    for (const log of recentActivityResult.value) {
      const item = mapActivityLogToDashboardItem(log, (d) => formatRelativeTime(d));
      if (item) {
        recentActivity.push({
          id: item.id,
          title: item.title,
          description: item.description,
          amountLabel: item.amountLabel,
          tag: item.tag,
          tagColor: item.tagColor,
          time: item.time,
        });
        if (recentActivity.length >= 5) break;
      }
    }
  }

  // Abonelik
  let subscription: MobileDashboardResponse["subscription"] = null;
  if (subscriptionResult.status === "fulfilled" && subscriptionResult.value) {
    const sub = subscriptionResult.value;
    subscription = {
      status: sub.status,
      planName: sub.statusLabel ?? null,
      trialEndsAt: null,
      remainingDays: sub.remainingDays ?? null,
    };
  }

  // Onboarding
  let onboarding: MobileDashboardOnboarding | null = null;
  if (onboardingResult.status === "fulfilled" && onboardingResult.value) {
    const oc = onboardingResult.value;
    if (oc.showChecklist) {
      const completed = oc.items.filter((i: { completed: boolean }) => i.completed).length;
      const nextItem = oc.items.find((i: { completed: boolean; label: string }) => !i.completed);
      onboarding = {
        progressPercent: oc.progressPercent,
        completedCount: completed,
        totalCount: oc.items.length,
        nextTaskLabel: nextItem?.label ?? null,
        dismissed: oc.dismissed,
        allComplete: oc.allComplete,
      };
    }
  }

  // Quick actions — permission-aware
  const quickActions: MobileDashboardQuickAction[] = [
    canSales && mobileRoleAllows(role, "sales", "write")
      ? { key: "new-sale", label: "Yeni Satış", route: "pos", hasNativeScreen: true }
      : null,
    canProducts && mobileRoleAllows(role, "products", "write")
      ? { key: "add-product", label: "Ürün Ekle", route: "products", hasNativeScreen: false }
      : null,
    canAccessModule(userRole, "customers", isOwner) && mobileRoleAllows(role, "customers", "write")
      ? { key: "add-customer", label: "Müşteri Ekle", route: "more", hasNativeScreen: false }
      : null,
    canInvoices && mobileRoleAllows(role, "invoices", "write")
      ? { key: "new-invoice", label: "Fatura Oluştur", route: "more", hasNativeScreen: false }
      : null,
    canInvoices && mobileRoleAllows(role, "invoices", "write")
      ? { key: "collect", label: "Tahsilat Al", route: "more", hasNativeScreen: false }
      : null,
  ].filter(Boolean) as MobileDashboardQuickAction[];

  return {
    company: { id: company.id, name: company.name, role, isOwner },
    subscription,
    summary: { todaySales, pendingCollection, lowStock, pendingInvoices },
    recentActivity,
    quickActions,
    onboarding,
  };
}
