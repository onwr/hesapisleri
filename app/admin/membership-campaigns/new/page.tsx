import { redirect } from "next/navigation";

export default function LegacyMembershipCampaignNewRedirect() {
  redirect("/admin/campaigns/new");
}
