import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { EditExpenseForm } from "@/components/expenses/edit-expense-form";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import {
  getExpenseCategoryOptions,
  getExpenseDetail,
} from "@/lib/expense-service";
type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditExpensePage({ params }: Props) {
  const session = await guardPageModule("expenses");
  const company = session.company;
const { id } = await params;

  const [expense, categories] = await Promise.all([
    getExpenseDetail(company.id, id),
    getExpenseCategoryOptions(company.id),
  ]);

  if (!expense || expense.status === "CANCELLED") notFound();

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-4">
            <Link
              href={`/expenses/${expense.id}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} strokeWidth={2.6} />
            </Link>

            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-600">
                <Sparkles size={14} strokeWidth={2.5} />
                Gider Düzenle
              </div>
              <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                {expense.title}
              </h1>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <EditExpenseForm
            expense={{
              id: expense.id,
              title: expense.title,
              category: expense.category,
              supplier: expense.supplier,
              amount: expense.amount,
              paymentStatus: expense.paymentStatus,
              date: expense.date.toISOString().split("T")[0],
              note: expense.note,
              status: expense.status,
            }}
            categories={categories}
          />
        </section>
      </div>
    </AppShell>
  );
}
