import { ForgotPasswordForm } from "@/components/forgot-password/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell variant="login">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
