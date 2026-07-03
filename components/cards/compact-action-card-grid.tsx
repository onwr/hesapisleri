import type { ReactNode } from "react";

type CompactActionCardGridProps = {
  children: ReactNode;
  columns?: "2" | "3" | "4" | "5" | "6";
  className?: string;
};

const columnClassMap: Record<NonNullable<CompactActionCardGridProps["columns"]>, string> = {
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-2 xl:grid-cols-3",
  "4": "sm:grid-cols-2 xl:grid-cols-4",
  "5": "sm:grid-cols-2 xl:grid-cols-5",
  "6": "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6",
};

export function CompactActionCardGrid({
  children,
  columns = "5",
  className,
}: CompactActionCardGridProps) {
  return (
    <section
      className={["grid grid-cols-1 gap-3", columnClassMap[columns], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}
