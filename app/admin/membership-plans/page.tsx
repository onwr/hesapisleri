import { permanentRedirect } from "next/navigation";

export default function LegacyMembershipPlansPage() {
  permanentRedirect("/admin/plans");
}
