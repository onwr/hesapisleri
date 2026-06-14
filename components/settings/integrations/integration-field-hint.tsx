import { Info } from "lucide-react";

type IntegrationFieldHintProps = {
  text: string;
  className?: string;
};

export function IntegrationFieldHint({ text, className }: IntegrationFieldHintProps) {
  return (
    <p
      className={[
        "mt-1 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Info size={12} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <span>{text}</span>
    </p>
  );
}
