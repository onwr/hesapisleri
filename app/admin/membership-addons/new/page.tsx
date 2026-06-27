import { redirect } from "next/navigation";

export default function LegacyMembershipAddonNewRedirect() {
  redirect("/admin/add-ons/new");
}
