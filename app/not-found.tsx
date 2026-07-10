import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import {
  AuthenticatedNotFoundPanel,
  PublicNotFoundPanel,
} from "@/components/layout/not-found-panels";
import { getOptionalSession } from "@/lib/auth/auth-dal";
import { isProtectedRoute } from "@/lib/auth/auth-routes";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı | Hesap İşleri",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NotFoundPage() {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const session = await getOptionalSession();
  const useAppShell =
    session?.status === "AUTHENTICATED" && isProtectedRoute(pathname);

  if (useAppShell) {
    return (
      <AppShell>
        <AuthenticatedNotFoundPanel />
      </AppShell>
    );
  }

  return <PublicNotFoundPanel />;
}
