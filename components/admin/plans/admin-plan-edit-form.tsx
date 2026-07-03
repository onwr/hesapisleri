"use client";

import { AdminPlanCreateForm } from "@/components/admin/plans/admin-plan-create-form";

type Props = {
  planId: string;
};

export function AdminPlanEditForm({ planId }: Props) {
  return <AdminPlanCreateForm planId={planId} />;
}
