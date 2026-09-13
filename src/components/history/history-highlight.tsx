import {
  Bug,
  Crown,
  Feather,
  MessageCircle,
  Search,
  ServerCrash,
  Sparkles,
  Swords,
  Utensils,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

const icons = {
  bug: Bug,
  crown: Crown,
  feather: Feather,
  message: MessageCircle,
  search: Search,
  server: ServerCrash,
  sparkles: Sparkles,
  swords: Swords,
  utensils: Utensils,
  wifi: WifiOff,
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
