import { ModuleGuardLayout } from "@/lib/guard-layout";

export default function AiAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGuardLayout module="ai-assistant">{children}</ModuleGuardLayout>;
}
