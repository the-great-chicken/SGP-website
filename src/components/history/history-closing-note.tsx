import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

type HistoryClosingNoteProps = {
  title: string;
  children: ReactNode;
};

export function HistoryClosingNote({ title, children }: HistoryClosingNoteProps) {
  return (
    <aside className="history-closing-note">
      <Sparkles size={19} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </aside>
  );
}
