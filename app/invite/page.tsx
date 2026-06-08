import { Suspense } from "react";
import { InviteClient } from "./invite-client";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export default function InvitePage() {
  return (
    <Suspense fallback={<AppLoadingScreen preset="login" />}>
      <InviteClient />
    </Suspense>
  );
}
