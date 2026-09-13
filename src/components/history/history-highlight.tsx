import { Bug, Feather, Sparkles, Swords, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const icons = {
  bug: Bug,
  feather: Feather,
  sparkles: Sparkles,
  swords: Swords,
} satisfies Record<string, LucideIcon>;

type HistoryHighlightProps = {
  icon: keyof typeof icons;
  title: string;
  children: ReactNode;
};

export function HistoryHighlight({ icon, title, children }: HistoryHighlightProps) {
  const Icon = icons[icon];

  return (
    <article className="history-highlight">
      <Icon aria-hidden="true" size={18} />
      <div>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </article>
  );
}
