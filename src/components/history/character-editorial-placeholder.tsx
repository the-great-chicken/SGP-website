import { PencilLine } from "lucide-react";
import type { ReactNode } from "react";

type CharacterEditorialPlaceholderProps = {
  title: string;
  children: ReactNode;
};

export function CharacterEditorialPlaceholder({ title, children }: CharacterEditorialPlaceholderProps) {
  return (
    <aside className="history-character-editorial-placeholder">
      <PencilLine size={18} aria-hidden="true" />
      <div>
        <p className="eyebrow">À écrire</p>
        <h3>{title}</h3>
        <div>{children}</div>
      </div>
    </aside>
  );
}
