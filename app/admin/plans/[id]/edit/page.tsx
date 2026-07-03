import { notFound } from "next/navigation";
import { AdminPlanEditForm } from "@/components/admin/plans/admin-plan-edit-form";
import { db } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPlanEditPage({ params }: PageProps) {
  const { id } = await params;
  const plan = await db.membershipPlan.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!plan) notFound();
  return <AdminPlanEditForm planId={id} />;
}
