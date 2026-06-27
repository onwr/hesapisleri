import { permanentRedirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function LegacyMembershipPlanDetailPage({ params }: PageProps) {
  const { id } = await params;
  permanentRedirect(`/admin/plans/${id}`);
}
