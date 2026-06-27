import { notFound } from "next/navigation";
import { AdminJobDetailContent } from "@/components/admin/jobs/admin-job-detail-content";
import {
  getAdminJobDetail,
  listAdminJobActivity,
  listAdminJobRuns,
} from "@/lib/admin/jobs";

type PageProps = {
  params: Promise<{ jobKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminJobDetailPage({ params, searchParams }: PageProps) {
  const { jobKey } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";
  const page = Number(sp.page ?? "1");

  const [job, runs, activity] = await Promise.all([
    getAdminJobDetail(jobKey),
    listAdminJobRuns(jobKey, Number.isFinite(page) && page > 0 ? page : 1, 25),
    listAdminJobActivity(jobKey),
  ]);

  if (!job) notFound();

  return (
    <AdminJobDetailContent
      job={job}
      runs={runs ?? { items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }}
      activity={activity ?? []}
      tab={tab}
    />
  );
}
