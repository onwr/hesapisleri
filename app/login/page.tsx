"use client";

import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export default function LoginPage() {
  return (
    <AuthShell variant="login">
      <Suspense fallback={<AppLoadingScreen preset="login" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
