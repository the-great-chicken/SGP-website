import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { historyEditions } from "@/content/history/editions";

type EditionNavigationProps = {
  editionNumber: number;
};

export function EditionNavigation({ editionNumber }: EditionNavigationProps) {
  const currentIndex = historyEditions.findIndex((edition) => edition.number === editionNumber);
  const previous = currentIndex > 0 ? historyEditions[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? historyEditions[currentIndex + 1] ?? null : null;

  return (
    <nav className="history-edition-navigation" aria-label="Navigation entre les éditions">
      {previous?.status === "published" ? (
        <Link href={`/wiki/editions/${previous.number}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span><small>Édition précédente</small><strong>{previous.shortTitle}</strong></span>
        </Link>
      ) : <span />}
      {next ? (
        next.status === "published" ? (
          <Link href={`/wiki/editions/${next.number}`}>
            <span><small>Édition suivante</small><strong>{next.shortTitle}</strong></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <div className="history-edition-navigation-planned" aria-label={`Édition ${next.number} à venir`}>
            <span><small>Édition suivante</small><strong>{next.shortTitle}</strong></span>
            <span className="history-status-chip">À venir</span>
          </div>
        )
      ) : <span />}
    </nav>
  );
}
