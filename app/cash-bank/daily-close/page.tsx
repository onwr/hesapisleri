import { AppShell } from "@/components/layout/app-shell";
import { CashDailyCloseClient } from "@/components/cash-bank/cash-daily-close-client";
import { guardPageModule } from "@/lib/module-access";
import { db } from "@/lib/prisma";
import { canManageAccounts } from "@/lib/permission-utils";
import { startOfZonedDay } from "@/lib/finance/financial-period";

function toDateInputValue(date: Date) {
  const start = startOfZonedDay(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(start);

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export default async function CashDailyClosePage() {
  const session = await guardPageModule("cash-bank");
  const companyId = session.company.id;
  const canManage = canManageAccounts(
    session.effectiveRole,
    session.companyUser.isOwner
  );

  const accounts = await db.account.findMany({
    where: {
      companyId,
      type: "CASH",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const defaultAccountId =
    accounts.find((account) => account.isDefault)?.id ?? accounts[0]?.id ?? "";

  return (
    <AppShell>
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <CashDailyCloseClient
          accounts={accounts.map((account) => ({
            id: account.id,
            name: account.name,
          }))}
          canManage={canManage}
          defaultAccountId={defaultAccountId}
          todayValue={toDateInputValue(new Date())}
        />
      </div>
    </AppShell>
  );
}
