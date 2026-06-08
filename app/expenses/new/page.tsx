import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NewExpenseForm } from "@/components/expenses/new-expense-form";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  getExpenseCategoryOptions,
  getExpenseFormAccounts,
} from "@/lib/expense-service";
import { db } from "@/lib/prisma";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function NewExpensePage() {
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

  const [accounts, categories] = await Promise.all([
    getExpenseFormAccounts(company.id),
    getExpenseCategoryOptions(company.id),
  ]);

  return (
    <AppShell>
      <NewExpenseForm accounts={accounts} categories={categories} />
    </AppShell>
  );
}
