import {
  getSystemLogMetrics,
  listDistinctSystemLogActions,
  listDistinctSystemLogModules,
  listSystemLogs,
  parseSystemLogListFilters,
} from "@/lib/admin/system-logs";
import { AdminSystemLogsContent } from "@/components/admin/system-logs/admin-system-logs-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSystemLogsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseSystemLogListFilters(params);

  const [list, metrics, modules, actions] = await Promise.all([
    listSystemLogs(filters),
    getSystemLogMetrics(),
    listDistinctSystemLogModules(),
    listDistinctSystemLogActions(),
  ]);

  return (
    <AdminSystemLogsContent
      list={list}
      metrics={metrics}
      filters={filters}
      modules={modules}
      actions={actions}
    />
  );
}
