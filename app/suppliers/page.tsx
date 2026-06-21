import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Edit3,
  Eye,
  FileSpreadsheet,
  Package,
  Star,
  Truck,
  UserX,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { SuppliersRowActions } from "@/components/suppliers/suppliers-row-actions";
import { guardPageModule } from "@/lib/module-access";
import { canManageSuppliers } from "@/lib/permission-utils";
import {
  SuppliersTablePagination,
  SuppliersTableToolbar,
} from "@/components/suppliers/suppliers-table-controls";
import {
  buildSuppliersExportQuery,
  formatSupplierMoney,
  getCategoryBadge,
  getInitials,
  getSupplierBalanceStatus,
  getSupplierStatusBadge,
  getSuppliersPageData,
  parseSuppliersPageOptions,
} from "@/lib/supplier-page-data";

type SuppliersPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    category?: string;
    q?: string;
    favorite?: string;
  }>;
};

const statIconMap = {
  truck: Truck,
  wallet: Wallet,
  check: CheckCircle2,
  bell: BellRing,
  package: Package,
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
      title: "Yeni Tedarikçi",
      description: "Tedarikçi ekle",
      href: "/suppliers/new",
      icon: Truck,
      gradient: "from-emerald-500 to-green-600",
    },
    {
      title: "Borçlu Tedarikçiler",
      description: "Borçlu tedarikçileri gör",
      href: "/suppliers?tab=payable",
      icon: Wallet,
      gradient: "from-rose-400 to-pink-600",
    },
    {
      title: "Vadesi Geçen",
      description: "Vadesi geçen borçları gör",
      href: "/suppliers?tab=overdue",
      icon: BellRing,
      gradient: "from-orange-400 to-orange-600",
    },
    {
      title: "Tedarikçi Excel",
      description: "Excel'e aktar",
      href: exportHref,
      icon: FileSpreadsheet,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Pasif Tedarikçiler",
      description: "Pasif kayıtları gör",
      href: "/suppliers?tab=passive",
      icon: UserX,
      gradient: "from-blue-500 to-blue-600",
    },
  ];
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const session = await guardPageModule("suppliers");
  const company = session.company;
  const canManage = canManageSuppliers(
    session.effectiveRole,
    session.companyUser.isOwner
  );
  const params = await searchParams;

  const options = parseSuppliersPageOptions(params);
  const {
    statCards,
    rows,
    categories,
    totalRecords,
    totalPages,
    currentPage,
  } = await getSuppliersPageData(company.id, options);

  const exportHref = buildSuppliersExportQuery({
    tab: options.tab,
    category: options.category,
    q: options.q,
    favorite: options.favorite,
  });

  const actionCards = buildActionCards(exportHref);
  const hasFilters =
    Boolean(options.q) ||
    Boolean(options.category) ||
    options.tab !== "all" ||
    options.favorite;

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {actionCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
                className={[
                  "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                  card.gradient,
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                    <Icon size={22} strokeWidth={2.4} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-black leading-tight">
                      {card.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                      {card.description}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={18}
                  strokeWidth={3}
                  className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
                />
              </Link>
            );
          })}
        </section>

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
          <SuppliersTableToolbar
            activeTab={options.tab}
            activeCategory={options.category}
            searchQuery={options.q}
            categories={categories}
            favoriteOnly={options.favorite}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                  <th className="px-4 py-3">Tedarikçi</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">E-Posta</th>
                  <th className="px-4 py-3">Vergi No</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Borç / Bakiye</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3 text-center">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.map((supplier) => {
                  const balanceStatus = getSupplierBalanceStatus(supplier.balance);
                  const statusBadge = getSupplierStatusBadge(supplier.isActive);

                  return (
                    <tr
                      key={supplier.id}
                      className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={[
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                              supplier.avatarColorClass,
                            ].join(" ")}
                          >
                            {getInitials(supplier.name) || "T"}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-extrabold text-[#0f1f4d]">
                              {supplier.name}
                              {supplier.isFavorite ? (
                                <Star
                                  size={12}
                                  className="ml-1 inline fill-amber-400 text-amber-400"
                                />
                              ) : null}
                            </p>
                            {supplier.contactName ? (
                              <p className="truncate text-[10px] font-medium text-slate-400">
                                {supplier.contactName}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {supplier.phone || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {supplier.email || "-"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {supplier.taxNumber || "-"}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-md px-2 py-1 text-[10px] font-black",
                            getCategoryBadge(supplier.category),
                          ].join(" ")}
                        >
                          {supplier.category || "Diğer"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className={[
                            "font-black tracking-[-0.01em]",
                            balanceStatus.amountClass,
                          ].join(" ")}
                        >
                          {formatSupplierMoney(
                            Math.abs(supplier.balance),
                            supplier.currency
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                          {balanceStatus.subLabel}
                          {supplier.overdueAmount > 0
                            ? ` · Vadesi geçen ${formatSupplierMoney(supplier.overdueAmount, supplier.currency)}`
                            : ""}
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
                            href={`/suppliers/${supplier.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                            title="Detay"
                          >
                            <Eye size={15} />
                          </Link>

                          <Link
                            href={`/suppliers/${supplier.id}/edit`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                            title="Düzenle"
                          >
                            <Edit3 size={15} />
                          </Link>

                          <SuppliersRowActions
                            supplierId={supplier.id}
                            supplierName={supplier.name}
                            canManage={canManage}
                          />
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
                          <Truck size={28} />
                        </div>

                        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                          {hasFilters
                            ? "Bu filtrede tedarikçi bulunamadı"
                            : "Henüz tedarikçi yok"}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {hasFilters
                            ? "Arama veya filtre kriterlerinizi değiştirerek tekrar deneyebilirsiniz."
                            : "İlk tedarikçinizi ekleyerek alım, borç ve ödeme takibine başlayabilirsiniz."}
                        </p>

                        <Link
                          href={hasFilters ? "/suppliers" : "/suppliers/new"}
                          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-black text-white"
                        >
                          {hasFilters ? "Filtreyi Temizle" : "İlk Tedarikçiyi Ekle"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <SuppliersTablePagination
            activeTab={options.tab}
            activeCategory={options.category}
            searchQuery={options.q}
            totalPages={totalPages}
            currentPage={currentPage}
            totalRecords={totalRecords}
            favoriteOnly={options.favorite}
          />
        </section>
      </div>
    </AppShell>
  );
}
