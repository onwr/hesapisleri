"use client";

import {
  CompactActionCard,
  type CompactActionColor,
  type CompactActionIconName,
} from "@/components/cards/compact-action-card";

export { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

type TeamActionButtonProps = {
  title: string;
  description: string;
  onClick: () => void;
  iconName: CompactActionIconName;
  gradient: string;
  color?: CompactActionColor;
};

function resolveColorFromGradient(gradient: string): CompactActionColor {
  if (gradient.includes("0f1f4d") || gradient.includes("navy")) return "navy";
  if (gradient.includes("violet") || gradient.includes("purple")) return "violet";
  if (gradient.includes("emerald") || gradient.includes("green")) return "emerald";
  return "blue";
}

export function TeamActionButton({
  title,
  description,
  onClick,
  iconName,
  gradient,
  color,
}: TeamActionButtonProps) {
  return (
    <CompactActionCard
      title={title}
      description={description}
      onClick={onClick}
      iconName={iconName}
      color={color ?? resolveColorFromGradient(gradient)}
    />
  );
}
