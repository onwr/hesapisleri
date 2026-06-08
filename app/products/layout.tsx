import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="products">{children}</ModuleGuardLayout>;
}
