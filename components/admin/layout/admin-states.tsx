import type { ReactNode } from "react";

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200">
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-[13px] text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AdminErrorState({
  title = "Veri yüklenemedi",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center dark:border-rose-900 dark:bg-rose-950/40">
      <p className="text-[14px] font-bold text-rose-700 dark:text-rose-300">
        {title}
      </p>
      {description ? (
        <p className="mt-1 text-[13px] text-rose-600 dark:text-rose-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
    </div>
  );
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-slate-100 dark:bg-slate-900" />
      ))}
    </div>
  );
}
