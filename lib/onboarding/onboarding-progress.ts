import { db } from "@/lib/prisma";
import { isCompanyProfileComplete } from "@/lib/onboarding/onboarding-company-utils";

export type OnboardingMilestones = {
  companyProfileComplete: boolean;
  hasDefaultWarehouse: boolean;
  hasDefaultCashAccount: boolean;
  productCount: number;
  stockMovementCount: number;
  customerCount: number;
  saleCount: number;
  integrationCount: number;
  teamMemberCount: number;
};

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  completed: boolean;
};

export async function getOnboardingMilestonesUncached(
  companyId: string
): Promise<OnboardingMilestones> {
  const [
    company,
    productCount,
    stockMovementCount,
    customerCount,
    saleCount,
    integrationCount,
    teamMemberCount,
    defaultWarehouse,
    defaultCash,
  ] = await Promise.all([
    db.company.findFirst({
      where: { id: companyId },
      select: { name: true },
    }),
    db.product.count({ where: { companyId } }),
    db.stockMovement.count({ where: { companyId } }),
    db.customer.count({ where: { companyId } }),
    db.sale.count({ where: { companyId } }),
    db.marketplaceIntegration.count({
      where: { companyId, status: "CONNECTED" },
    }),
    db.companyUser.count({
      where: { companyId, status: "ACTIVE" },
    }),
    db.warehouse.findFirst({
      where: { companyId, isDefault: true, status: "ACTIVE" },
      select: { id: true },
    }),
    db.account.findFirst({
      where: {
        companyId,
        type: "CASH",
        status: "ACTIVE",
        isDefault: true,
      },
      select: { id: true },
    }),
  ]);

  return {
    companyProfileComplete: isCompanyProfileComplete(company?.name),
    hasDefaultWarehouse: Boolean(defaultWarehouse),
    hasDefaultCashAccount: Boolean(defaultCash),
    productCount,
    stockMovementCount,
    customerCount,
    saleCount,
    integrationCount,
    teamMemberCount,
  };
}

export function buildOnboardingChecklist(
  milestones: OnboardingMilestones
): OnboardingChecklistItem[] {
  return [
    {
      id: "company_profile",
      label: "Firma bilgilerini tamamla",
      description: "Firma adı ve iletişim bilgilerinizi güncelleyin.",
      href: "/onboarding",
      completed: milestones.companyProfileComplete,
    },
    {
      id: "first_product",
      label: "İlk ürününü ekle",
      description: "Ürün kataloğunuza ilk kaydı ekleyin.",
      href: "/products/new?returnTo=/dashboard",
      completed: milestones.productCount > 0,
    },
    {
      id: "first_stock",
      label: "İlk stok girişini yap",
      description: "Depoya stok hareketi ile ürün miktarı tanımlayın.",
      href: "/stocks",
      completed: milestones.stockMovementCount > 0,
    },
    {
      id: "first_customer",
      label: "İlk müşterini oluştur",
      description: "Satış ve tahsilat için müşteri kaydı açın.",
      href: "/customers/new?returnTo=/dashboard",
      completed: milestones.customerCount > 0,
    },
    {
      id: "first_sale",
      label: "İlk satışını gerçekleştir",
      description: "POS veya satış ekranından ilk işleminizi yapın.",
      href: "/pos",
      completed: milestones.saleCount > 0,
    },
    {
      id: "integration",
      label: "Pazaryeri entegrasyonu kur",
      description: "Trendyol veya Hepsiburada bağlantısını yapılandırın.",
      href: "/settings/integrations",
      completed: milestones.integrationCount > 0,
    },
    {
      id: "team_member",
      label: "Ekibinden birini ekle",
      description: "Davet göndererek ekibinizi genişletin.",
      href: "/team",
      completed: milestones.teamMemberCount > 1,
    },
  ];
}

export function calculateChecklistProgressPercent(
  items: OnboardingChecklistItem[]
): number {
  if (items.length === 0) return 0;
  const completed = items.filter((item) => item.completed).length;
  return Math.round((completed / items.length) * 100);
}
