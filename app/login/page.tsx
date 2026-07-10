import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LoginForm } from "@/components/login/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import {
  getAuthenticatedRedirectTarget,
  resolveAuthState,
} from "@/lib/auth/auth-dal";
import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";
import { isDemoLoginEnabled } from "@/lib/demo-login-service";
import {
  AUTH_COOKIE_NAME,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    redirect?: string;
    reason?: string;
  }>;
};

async function clearStaleAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", getClearAuthCookieOptions());
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextParam = params.next ?? params.redirect ?? null;
  const state = await resolveAuthState();

  if (
    state.status === "INVALID_SESSION" ||
    params.reason === "session-expired"
  ) {
    await clearStaleAuthCookie();
  }

  if (state.status === "INVALID_SESSION") {
    // Cookie temizlendi; giriş formunu göster.
  } else {
    const authenticatedTarget = await getAuthenticatedRedirectTarget(nextParam);

    if (authenticatedTarget) {
      const destination = nextParam
        ? sanitizeAuthRedirectPath(nextParam, {
            fallback: authenticatedTarget,
          })
        : authenticatedTarget;
      redirect(destination);
    }
  }

  return (
    <AuthShell variant="login">
      <Suspense fallback={<AppLoadingScreen preset="login" />}>
        <LoginForm
          sessionExpired={
            params.reason === "session-expired" ||
            state.status === "INVALID_SESSION"
          }
          demoLoginEnabled={isDemoLoginEnabled()}
        />
      </Suspense>
    </AuthShell>
  );
}
