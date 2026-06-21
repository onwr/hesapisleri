import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { CustomerBulkActionsPanel } from "@/components/customers/customer-bulk-actions-panel";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import {
  getBulkActionsPageData,
  parseBulkFilters,
} from "@/lib/customer-bulk-actions-data";
type BulkActionsPageProps = {
  searchParams: Promise<{
    group?: string;
    status?: string;
    balanceType?: string;
    search?: string;
  }>;
};

export default async function CustomerBulkActionsPage({ searchParams,
}: BulkActionsPageProps) {
  const session = await guardPageModule("customers");
  const company = session.company;
const params = await searchParams;
  const filters = parseBulkFilters(params);
  const { groups, customers, summary } = await getBulkActionsPageData(
    company.id,
    filters
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/customers"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-black text-orange-600">
                  <Users size={14} strokeWidth={2.5} />
                  Toplu Müşteri İşlemleri
                </div>

                <h1 className="text-[26px] font-black tracking-tighter text-[#0f1f4d]">
                  Toplu Müşteri İşlemleri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Müşterilerinizi grup, durum ve cari bakiyeye göre filtreleyip
                  toplu aksiyonlar alın.
                </p>
              </div>
            </div>
          </div>
        </section>

        <CustomerBulkActionsPanel
          groups={groups}
          initialFilters={filters}
          initialCustomers={customers}
          initialSummary={summary}
        />
      </div>
    </AppShell>
  );
}
