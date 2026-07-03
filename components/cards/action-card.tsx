import {
  CompactActionCard,
  type CompactActionColor,
  type CompactActionIconName,
} from "@/components/cards/compact-action-card";

type ActionCardProps = {
  title: string;
  description: string;
  href: string;
  iconName: CompactActionIconName;
  gradient: string;
  color?: CompactActionColor;
};

function resolveColorFromGradient(gradient: string): CompactActionColor {
  if (gradient.includes("emerald") || gradient.includes("green")) return "emerald";
  if (gradient.includes("violet") || gradient.includes("purple")) return "violet";
  if (gradient.includes("orange")) return "orange";
  if (gradient.includes("rose") || gradient.includes("pink")) return "rose";
  if (gradient.includes("sky")) return "sky";
  if (gradient.includes("amber") || gradient.includes("yellow")) return "amber";
  if (gradient.includes("0f1f4d") || gradient.includes("navy")) return "navy";
  return "blue";
}

export function ActionCard({
  title,
  description,
  href,
  iconName,
  gradient,
  color,
}: ActionCardProps) {
  return (
    <CompactActionCard
      title={title}
      description={description}
      href={href}
      iconName={iconName}
      color={color ?? resolveColorFromGradient(gradient)}
    />
  );
}
