"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  Receipt,
  UserPlus,
  Users,
  UserX,
  Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import { TeamActionButton } from "@/components/team/team-action-button";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";
import { TEAM_CARD_CLASS, TEAM_HERO_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import type { EmployeeStats } from "@/lib/employee-page-utils";

type TeamShellProps = {
  stats: EmployeeStats;
  onCreateEmployee: () => void;
  canManageEmployees: boolean;
  isReadOnlyViewer?: boolean;
  children: ReactNode;
};

export function TeamShell({
  stats,
  onCreateEmployee,
  canManageEmployees,
  isReadOnlyViewer = false,
  children,
}: TeamShellProps) {
  return (
    <div className="space-y-4">
      <section className={TEAM_HERO_CLASS}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Users size={22} />
            </div>
            <div className="max-w-2xl">
              <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-[#0f1f4d] sm:text-[28px]">
                Çalışanlar
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Personellerinizi, görevlerini, izinlerini, ödemelerini ve satış
                performanslarını tek ekrandan takip edin.
              </p>
            </div>
          </div>

          {canManageEmployees ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCreateEmployee}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] transition hover:bg-[#162a5c]"
              >
                <UserPlus size={16} />
                Çalışan Ekle
              </button>
              <Link
                href="/team/departments"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                Departmanları Yönet
              </Link>
            </div>
          ) : null}
        </div>

        {isReadOnlyViewer ? (
          <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Salt okunur görünüm: ödeme kayıtlarını görüntüleyebilir ve ödeme
            işaretleyebilirsiniz. Çalışan ve hedef yönetimi kapalıdır.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Aktif Çalışan"
          value={String(stats.activeCount)}
          subtitle="Görevdeki personel"
          icon={<Users size={18} />}
          color="blue"
        />
        <StatCard
          title="İzinli Çalışan"
          value={String(stats.onLeaveCount)}
          subtitle="Onaylı izinde"
          icon={<CalendarClock size={18} />}
          color="purple"
        />
        <StatCard
          title="Bekleyen Ödeme"
          value={String(stats.pendingPaymentCount)}
          subtitle={
            stats.monthlyPayable > 0
              ? `Toplam ${formatMoney(stats.monthlyPayable)}`
              : "Ödeme bekleyen kayıt"
          }
          highlight={
            stats.pendingPaymentCount > 0 ? "Ödeme takibi gerekli" : undefined
          }
          icon={<Wallet size={18} />}
          color="orange"
        />
        <StatCard
          title="Bu Ay Satış Yapan"
          value={String(stats.salesThisMonthEmployeeCount)}
          subtitle={
            stats.thisMonthSalesTotal > 0
              ? formatMoney(stats.thisMonthSalesTotal)
              : "Satış kaydı olan personel"
          }
          icon={<BarChart3 size={18} />}
          color="green"
        />
        <StatCard
          title="Pasif Çalışan"
          value={String(stats.passiveCount)}
          subtitle="Arşivlenmiş kayıtlar hariç"
          icon={<UserX size={18} />}
          color="red"
        />
      </section>

      <CompactActionCardGrid columns="4">
        {canManageEmployees ? (
          <TeamActionButton
            title="Çalışan Ekle"
            description="Yeni personel kaydı oluştur"
            onClick={onCreateEmployee}
            iconName="user-plus"
            gradient="bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a]"
            color="navy"
          />
        ) : null}
        {canManageEmployees ? (
          <ActionCard
            title="Departmanları Yönet"
            description="Departmanları düzenle"
            href="/team/departments"
            iconName="building-2"
            gradient="bg-linear-to-br from-violet-500 to-purple-600"
            color="violet"
          />
        ) : null}
        <ActionCard
          title="Bordro"
          description="Maaş ve bordro işlemleri"
          href="/team/payroll"
          iconName="receipt"
          gradient="bg-linear-to-br from-sky-400 to-blue-600"
          color="sky"
        />
        <ActionCard
          title="Performans Raporu"
          description="Personel performansını incele"
          href="/reports/personnel-performance"
          iconName="bar-chart-3"
          gradient="bg-linear-to-br from-emerald-500 to-green-600"
          color="emerald"
        />
      </CompactActionCardGrid>

      <section className={[TEAM_CARD_CLASS, "overflow-hidden"].join(" ")}>
        {children}
      </section>
    </div>
  );
}
