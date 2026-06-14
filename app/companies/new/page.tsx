"use client";

import { CreateCompanyWizard } from "@/components/companies/create-company-wizard";
import { AuthShell } from "@/components/auth/auth-shell";

export default function CreateCompanyPage() {
  return (
    <AuthShell variant="onboarding" maxWidth="xl">
      <CreateCompanyWizard />
    </AuthShell>
  );
}
