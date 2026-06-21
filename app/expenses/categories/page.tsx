import Link from "next/link";
import { ArrowLeft, Grid2X2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import { ExpenseCategoriesManager } from "@/components/expenses/expense-categories-manager";
import { getExpenseCategoriesWithStats } from "@/lib/expense-category-service";
export default async function ExpenseCategoriesPage() {
  const session = await guardPageModule("expenses");
  const company = session.company;
const { categories, summary } = await getExpenseCategoriesWithStats(
    company.id
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/expenses"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-600">
                  <Grid2X2 size={14} strokeWidth={2.5} />
                  Gider Kategorileri
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  Gider Kategorileri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Giderlerinizi kategori bazlı takip edin, ödenmiş/ödenmemiş
                  tutarları yönetin.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ExpenseCategoriesManager categories={categories} summary={summary} />
      </div>
    </AppShell>
  );
}
