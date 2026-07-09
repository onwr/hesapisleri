import { ForgotPasswordForm } from "@/components/forgot-password/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isMailConfigured } from "@/lib/mail-service";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  const mailConfigured = isMailConfigured();

  return (
    <AuthShell variant="login">
      <ForgotPasswordForm mailConfigured={mailConfigured} />
    </AuthShell>
  );
}
