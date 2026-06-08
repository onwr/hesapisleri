import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  FileSpreadsheet,
  Package,
  Plus,
  Tags,
  Upload,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProductsSelectableTable } from "@/components/products/products-selectable-table";
import {
  ProductsTablePagination,
  ProductsTableToolbar,
} from "@/components/products/products-table-controls";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getProductsPageData } from "@/lib/products-page-data";
import {
  buildProductsExportQuery,
  parseCategoryFilter,
  parsePage,
  parseProductTab,
  parseSearchQuery,
} from "@/lib/products-page-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type ProductsPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    category?: string;
    q?: string;
  }>;
};

const statIconMap = {
  package: Package,
  boxes: Boxes,
  alert: AlertTriangle,
  wallet: Wallet,
  spreadsheet: FileSpreadsheet,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-500",
  violet: "bg-violet-50 text-violet-600",
};

function buildActionCards(exportHref: string) {
  return [
    {
      title: "Yeni Ürün Ekle",
      description: "Ürün ekle",
      href: "/products/new",
      icon: Plus,
      gradient: "from-emerald-500 to-green-600",
    },
    {
      title: "Ürün Kategorileri",
      description: "Kategorileri yönet",
      href: "/products/categories",
      icon: Tags,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Stok Girişi",
      description: "Stok miktarı artır",
      href: "/stocks",
      icon: ArrowDownToLine,
      gradient: "from-orange-400 to-orange-600",
    },
    {
      title: "Stok Çıkışı",
      description: "Stok miktarı azalt",
      href: "/stocks",
      icon: Upload,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Fiyat Listesi",
      description: "Listeyi dışa aktar",
      href: exportHref,
      icon: Tags,
      gradient: "from-rose-400 to-pink-600",
    },
  ];
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const token = await getAuthToken();

  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const activeTab = parseProductTab(params.tab);
  const currentPage = parsePage(params.page);
  const activeCategory = parseCategoryFilter(params.category);
  const searchQuery = parseSearchQuery(params.q);

  const {
    statCards,
    rows,
    categories,
    totalRecords,
    totalPages,
    currentPage: page,
  } = await getProductsPageData(company.id, {
    tab: activeTab,
    page: currentPage,
    category: activeCategory,
    q: searchQuery,
  });

  const exportHref = buildProductsExportQuery({
    tab: activeTab,
    category: activeCategory,
    q: searchQuery,
  });

  const actionCards = buildActionCards(exportHref);
  const hasFilters = Boolean(searchQuery || activeCategory || activeTab !== "all");

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
          <ProductsTableToolbar
            activeTab={activeTab}
            activeCategory={activeCategory}
            searchQuery={searchQuery}
            categories={categories}
          />

          <ProductsSelectableTable
            rows={rows}
            exportHref={exportHref}
            hasFilters={hasFilters}
          />

          <ProductsTablePagination
            activeTab={activeTab}
            activeCategory={activeCategory}
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
