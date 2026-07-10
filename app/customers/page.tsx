import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Mail,
  MoreVertical,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ResponsivePageHeader } from "@/components/layout/responsive-page-header";
import { guardPageModule } from "@/lib/module-access";

import {
  CustomersTablePagination,
  CustomersTableToolbar,
} from "@/components/customers/customers-table-controls";
import { getCachedCustomersPageData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  buildCustomersExportQuery,
  formatCustomerMoney,
  getBalanceStatus,
  getCustomerStatusBadge,
  getGroupBadge,
  getInitials,
  parseCustomerTab,
  parseGroupFilter,
  parsePage,
  parseSearchQuery,
  buildSingleCustomerExportHref,
} from "@/lib/customers-page-utils";
import { AiPageTriggerButton } from "@/components/ai-assistant/ai-page-trigger-button";
import {
  CompactActionCard,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

type CustomersPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    group?: string;
    q?: string;
  }>;
};

const statIconMap = {
  users: Users,
  wallet: Wallet,
  check: CheckCircle2,
  bell: BellRing,
  userPlus: UserPlus,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-500",
  orange: "bg-orange-50 text-orange-500",
  blue: "bg-blue-50 text-blue-600",
};

function buildActionCards(exportHref: string) {
  return [
    {
      title: "Yeni Müşteri",
      description: "Müşteri ekle",
      href: "/customers/new",
      iconName: "user-plus" as const,
      color: "emerald" as const,
    },
    {
      title: "Müşteri Grupları",
      description: "Grupları yönet",
      href: "/customers/groups",
      iconName: "users" as const,
      color: "blue" as const,
    },
    {
      title: "Toplu İşlemler",
      description: "Toplu mail, sms gönder",
      href: "/customers/bulk-actions",
      iconName: "mail" as const,
      color: "orange" as const,
    },
    {
      title: "Müşteri Excel",
      description: "Excel'e aktar",
      href: exportHref,
      iconName: "file-spreadsheet" as const,
      color: "violet" as const,
    },
    {
      title: "Borçlu Müşteriler",
      description: "Borçlu müşterileri gör",
      href: "/customers?tab=debtors",
      iconName: "bell-ring" as const,
      color: "rose" as const,
    },
  ];
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await guardPageModule("customers");
  const company = session.company;
  const params = await searchParams;
const activeTab = parseCustomerTab(params.tab);
  const currentPage = parsePage(params.page);
  const activeGroup = parseGroupFilter(params.group);
  const searchQuery = parseSearchQuery(params.q);

  const {
    statCards,
    rows,
    groups,
    totalRecords,
    totalPages,
    currentPage: page,
  } = await getCachedCustomersPageData({
    companyId: company.id,
    tab: activeTab,
    page: currentPage,
    group: activeGroup,
    q: searchQuery,
  });

  const exportHref = buildCustomersExportQuery({
    tab: activeTab,
    group: activeGroup,
    q: searchQuery,
  });

  const actionCards = buildActionCards(exportHref);

  return (
    <AppShell>
      <TenantPageSync />
      <div className="space-y-5">
        <ResponsivePageHeader
          title="Müşteriler"
          description="Satış, bakiye ve cari hesap yönetimi. İletişim rehberi için Fihrist modülünü kullanın."
        />
        <div className="flex justify-end">
          <AiPageTriggerButton moduleKey="customers" />
        </div>

        <CompactActionCardGrid columns="5">
          {actionCards.map((card) => (
            <CompactActionCard
              key={card.title}
              title={card.title}
              description={card.description}
              href={card.href}
              iconName={card.iconName}
              color={card.color}
            />
          ))}
        </CompactActionCardGrid>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold text-[#24345f]/80">
                      {stat.title}
                    </p>

                    <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={22} strokeWidth={2.4} />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span>{stat.subtitle}</span>
                  {stat.secondSubtitle ? (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{stat.secondSubtitle}</span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <CustomersTableToolbar
            activeTab={activeTab}
            activeGroup={activeGroup}
            searchQuery={searchQuery}
            groups={groups}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                  <th className="px-4 py-3">Müşteri Adı</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">E-Posta</th>
                  <th className="px-4 py-3">Vergi No / T.C. No</th>
                  <th className="px-4 py-3">Grup</th>
                  <th className="px-4 py-3">Borç / Alacak</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-center">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((customer) => {
                  const balanceStatus = getBalanceStatus(customer.balance);
                  const statusBadge = getCustomerStatusBadge(customer.status);

                  return (
                    <tr
                      key={customer.id}
                      className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={[
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                              customer.avatarColorClass,
                            ].join(" ")}
                          >
                            {getInitials(customer.name) || "M"}
                          </div>

                          <Link
                            href={`/customers/${customer.id}`}
                            className="truncate font-extrabold text-[#0f1f4d] hover:text-blue-700 hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {customer.phone || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {customer.email || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div>
                          <p>{customer.taxNo || "-"}</p>
                          {customer.taxOffice ? (
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                              {customer.taxOffice}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black",
                            getGroupBadge(customer.group, customer.groupColor),
                          ].join(" ")}
                        >
                          {customer.group}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className={[
                            "font-black tracking-[-0.01em]",
                            balanceStatus.amountClass,
                          ].join(" ")}
                        >
                          {formatCustomerMoney(Math.abs(customer.balance))}
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                          {balanceStatus.subLabel}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black",
                            statusBadge.className,
                          ].join(" ")}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                            title="Detay"
                          >
                            <Eye size={15} />
                          </Link>

                          <Link
                            href={`/customers/${customer.id}/edit`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                            title="Düzenle"
                          >
                            <Edit3 size={15} />
                          </Link>

                          <a
                            href={buildSingleCustomerExportHref(customer.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                            title="Müşteriyi indir"
                          >
                            <Download size={15} />
                          </a>

                          <Link
                            href={`/customers/${customer.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                            title="Diğer"
                          >
                            <MoreVertical size={15} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                          <Users size={28} />
                        </div>

                        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                          {searchQuery || activeGroup || activeTab !== "all"
                            ? "Bu filtrede müşteri bulunamadı"
                            : "Henüz müşteri yok"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {searchQuery || activeGroup || activeTab !== "all"
                            ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz."
                            : "İlk müşterinizi ekleyerek satış ve tahsilat takibine başlayabilirsiniz."}
                        </p>

                        <Link
                          href={
                            searchQuery || activeGroup || activeTab !== "all"
                              ? "/customers"
                              : "/customers/new?returnTo=/onboarding"
                          }
                          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                        >
                          {searchQuery || activeGroup || activeTab !== "all"
                            ? "Filtreyi Temizle"
                            : "İlk Müşteriyi Ekle"}
                        </Link>
                        {!searchQuery && activeTab === "all" && !activeGroup ? (
                          <Link
                            href="/onboarding"
                            className="mt-3 block text-sm font-semibold text-blue-600 hover:underline"
                          >
                            Kurulum rehberine dön
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <CustomersTablePagination
            activeTab={activeTab}
            activeGroup={activeGroup}
            searchQuery={searchQuery}
            totalPages={totalPages}
            currentPage={page}
            totalRecords={totalRecords}
          />
        </section>
      </div>
    </AppShell>
  );
}
