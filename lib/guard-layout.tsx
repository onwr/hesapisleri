import type { ReactNode } from "react";
import { guardPageModule } from "@/lib/module-access";
import type { AppModule } from "@/lib/permission-utils";

export async function ModuleGuardLayout({
  module,
  children,
}: {
  module: AppModule;
  children: ReactNode;
}) {
  await guardPageModule(module);
  return children;
}
