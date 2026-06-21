import { redirect } from "next/navigation";
import { KVKK_AYDINLATMA_PATH } from "@/lib/legal/kvkk-consent";

export default function KvkkLegacyRedirectPage() {
  redirect(KVKK_AYDINLATMA_PATH);
}
