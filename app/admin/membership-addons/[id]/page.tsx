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
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function mapTab(tab: string | undefined) {
  if (tab === "general") return "overview";
  if (tab === "prices") return "pricing";
  if (tab === "companies") return "subscriptions";
  return tab;
}

export default async function LegacyMembershipAddonDetailRedirect({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const next: Record<string, string | string[] | undefined> = { ...sp };
  if (typeof sp.tab === "string") next.tab = mapTab(sp.tab) ?? sp.tab;
  redirect(`/admin/add-ons/${id}${buildQuery(next)}`);
}
