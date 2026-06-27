"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAdminMoney } from "@/lib/admin-utils";
import { appCardClass } from "@/lib/admin-ui";
import type { AdminOverviewData } from "@/lib/admin/admin-overview-service";

const PIE_COLORS = ["#2563eb", "#f59e0b", "#ef4444", "#64748b", "#8b5cf6"];

function ChartShell({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className={appCardClass}>
      <h3 className="mb-3 text-[12px] font-bold text-[#24345f]/80">{title}</h3>
      {empty ? (
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[12px] font-medium text-slate-500">
          Bu dönem için veri yok.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function AdminOverviewCharts({
  revenueSeries,
  companyGrowthSeries,
  subscriptionDistribution,
  userActivitySeries,
}: Pick<
  AdminOverviewData,
  | "revenueSeries"
  | "companyGrowthSeries"
  | "subscriptionDistribution"
  | "userActivitySeries"
>) {
  const revenueHasData = revenueSeries.some(
    (point) => point.paid > 0 || point.failed > 0 || point.refunded > 0
  );
  const growthHasData = companyGrowthSeries.some(
    (point) =>
      point.newCompanies > 0 || point.paidConversions > 0 || point.cancelled > 0
  );
  const userHasData = userActivitySeries.some(
    (point) => point.newUsers > 0 || point.logins > 0
  );
  const distributionTotal = subscriptionDistribution.reduce(
    (sum, item) => sum + item.value,
    0
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartShell title="Gelir Grafiği" empty={!revenueHasData}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={48} />
              <Tooltip formatter={(value) => formatAdminMoney(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="paid" name="Tahsilat" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="refunded" name="İade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Başarısız" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="comparisonPaid"
                name="Önceki dönem"
                stroke="#94a3b8"
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>

      <ChartShell title="Firma Büyümesi" empty={!growthHasData}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={companyGrowthSeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="newCompanies" name="Yeni firma" fill="#22c55e" />
              <Bar dataKey="paidConversions" name="Ücretliye dönüşüm" fill="#2563eb" />
              <Bar dataKey="cancelled" name="İptal" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>

      <ChartShell title="Abonelik Dağılımı" empty={distributionTotal === 0}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={subscriptionDistribution}
                dataKey="value"
                nameKey="label"
                innerRadius={50}
                outerRadius={78}
                paddingAngle={2}
              >
                {subscriptionDistribution.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>

      <ChartShell title="Kullanıcı Aktivitesi" empty={!userHasData}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userActivitySeries}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="newUsers" name="Yeni kullanıcı" fill="#06b6d4" />
              <Bar dataKey="activeUsers" name="Giriş yapan" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartShell>
    </div>
  );
}
