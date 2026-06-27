import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPartnerApplicationDetail } from "@/components/admin/admin-partner-application-detail";
import { AdminPartnerApplicationServiceError, getPartnerApplicationDetail } from "@/lib/admin/partner-applications";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPartnerApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const detail = await getPartnerApplicationDetail(id);
    return (
      <AdminPageContainer size="full">
        <AdminPartnerApplicationDetail detail={detail} />
      </AdminPageContainer>
    );
  } catch (error) {
    if (error instanceof AdminPartnerApplicationServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
