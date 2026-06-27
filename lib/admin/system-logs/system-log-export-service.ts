import "server-only";

import { db } from "@/lib/prisma";
import {
  buildSystemLogWhere,
  serializeSystemLogCsvRow,
} from "@/lib/admin/system-logs/system-log-query-service";
import type { SystemLogListFilters } from "@/lib/admin/system-logs/system-log-types";

const CSV_HEADERS = [
  "createdAt",
  "action",
  "module",
  "actor",
  "company",
  "entityType",
  "entityId",
  "source",
  "result",
  "message",
] as const;

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportSystemLogsCsv(filters: SystemLogListFilters): Promise<string> {
  const where = buildSystemLogWhere(filters);
  const maxRows = 10_000;

  const rows = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: maxRows,
    select: {
      id: true,
      createdAt: true,
      action: true,
      module: true,
      message: true,
      entityType: true,
      entityId: true,
      companyId: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });

  const lines = [CSV_HEADERS.join(",")];

  for (const row of rows) {
    const serialized = serializeSystemLogCsvRow(row);
    lines.push(
      CSV_HEADERS.map((key) => escapeCsv(String(serialized[key] ?? ""))).join(",")
    );
  }

  return lines.join("\n");
}
