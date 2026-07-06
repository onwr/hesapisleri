import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell variant="login">
      <Suspense fallback={<AppLoadingScreen preset="login" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
