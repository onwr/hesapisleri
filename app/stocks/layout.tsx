import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function StocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="stocks">{children}</ModuleGuardLayout>;
}
