import { AppShell } from "@/components/layout/app-shell";
import { NewExpenseForm } from "@/components/expenses/new-expense-form";
import { guardPageModule } from "@/lib/module-access";
import {
  getExpenseCategoryOptions,
  getExpenseFormAccounts,
} from "@/lib/expense-service";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string }>;
}) {
  const session = await guardPageModule("expenses");
  const company = session.company;
  const params = await searchParams;
  const [accounts, categories] = await Promise.all([
    getExpenseFormAccounts(company.id),
    getExpenseCategoryOptions(company.id),
  ]);

  return (
    <AppShell>
      <NewExpenseForm
        accounts={accounts}
        categories={categories}
        initialSupplierId={params.supplierId ?? ""}
      />
    </AppShell>
  );
}
