import { getSystemHealthSnapshot } from "@/lib/admin/system-health";
import { AdminSystemHealthContent } from "@/components/admin/system-health/admin-system-health-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSystemHealthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const refresh = params.refresh === "1";

  const data = await getSystemHealthSnapshot({ refresh });

  return <AdminSystemHealthContent initial={data} />;
}
