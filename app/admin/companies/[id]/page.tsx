import { notFound } from "next/navigation";
import { AdminCompanyDetailContent } from "@/components/admin/admin-company-detail-content";
import { getAdminCompanyDetail } from "@/lib/admin-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const company = await getAdminCompanyDetail(id);

  if (!company) {
    notFound();
  }

  return <AdminCompanyDetailContent company={company} />;
}
