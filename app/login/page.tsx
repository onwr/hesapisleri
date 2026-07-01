import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import {
  getAuthenticatedRedirectTarget,
  resolveAuthState,
} from "@/lib/auth/auth-dal";
import { buildClearSessionUrl } from "@/lib/auth/auth-redirect";
import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";
import { isDemoLoginEnabled } from "@/lib/demo-login-service";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    redirect?: string;
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextParam = params.next ?? params.redirect ?? null;
  const state = await resolveAuthState();

  if (state.status === "INVALID_SESSION") {
    redirect(buildClearSessionUrl("/login?reason=session-expired"));
  }

  const authenticatedTarget = await getAuthenticatedRedirectTarget(nextParam);

  if (authenticatedTarget) {
    const destination = nextParam
      ? sanitizeAuthRedirectPath(nextParam, {
          fallback: authenticatedTarget,
        })
      : authenticatedTarget;
    redirect(destination);
  }

  return (
    <AuthShell variant="login">
      <Suspense fallback={<AppLoadingScreen preset="login" />}>
        <LoginForm
          sessionExpired={params.reason === "session-expired"}
          demoLoginEnabled={isDemoLoginEnabled()}
        />
      </Suspense>
    </AuthShell>
  );
}
