import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminSystemLogDetailContent } from "@/components/admin/system-logs/admin-system-log-detail-content";
import { appOutlineButtonClass } from "@/lib/admin-ui";
import { getSystemLogDetail } from "@/lib/admin/system-logs";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSystemLogDetailPage({ params }: PageProps) {
  const { id } = await params;
  const log = await getSystemLogDetail(id);

  if (!log) notFound();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Log Detayı"
        description={`${log.action} · ${log.module}`}
        secondaryActions={
          <Link href="/admin/system-logs" className={appOutlineButtonClass}>
            Listeye dön
          </Link>
        }
      />
      <AdminSystemLogDetailContent log={log} />
    </AdminPageContainer>
  );
}
