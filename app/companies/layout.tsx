import type { ReactNode } from "react";
import { requireCompanySelectionAccess } from "@/lib/auth/auth-dal";

export default async function CompaniesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCompanySelectionAccess();
  return children;
}
