import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="orders">{children}</ModuleGuardLayout>;
}
