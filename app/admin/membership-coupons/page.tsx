import { redirect } from "next/navigation";

type PageProps = {
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

export default async function LegacyMembershipCouponsRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  redirect(`/admin/coupons${buildQuery(params)}`);
}
