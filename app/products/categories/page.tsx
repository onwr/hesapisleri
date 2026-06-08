import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tags } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ProductCategoriesManager } from "@/components/products/product-categories-manager";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getProductCategoriesWithStats } from "@/lib/product-category-service";
import { db } from "@/lib/prisma";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function ProductCategoriesPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: { company: true },
      },
    },
  });

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const { categories, summary } = await getProductCategoriesWithStats(
    company.id
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/products"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-600">
                  <Tags size={14} strokeWidth={2.5} />
                  Ürün Kategorileri
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  Ürün Kategorileri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Ürünlerinizi kategori bazlı yönetin, stok ve satış dağılımını
                  takip edin.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ProductCategoriesManager categories={categories} summary={summary} />
      </div>
    </AppShell>
  );
}
