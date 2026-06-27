import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildQuery(params: Record<string, string | string[] | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, value);
  }
  const tab = qs.get("tab");
  if (tab === "scope") qs.set("tab", "targeting");
  if (tab === "preview") qs.set("tab", "pricing");
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function LegacyMembershipCampaignDetailRedirect({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  redirect(`/admin/campaigns/${id}${buildQuery(sp)}`);
}
