import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy route → canonical system logs */
export default async function AdminLogsRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    query.set(k, Array.isArray(v) ? v[0]! : v);
  }
  const qs = query.toString();
  redirect(qs ? `/admin/system-logs?${qs}` : "/admin/system-logs");
}
