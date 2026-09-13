import { ArrowRight, FileClock } from "lucide-react";
import Link from "next/link";
import { getHistoryChangelog } from "@/content/history/changelogs";

type EditionChangelogCardProps = {
  editionNumber: number;
};

export function EditionChangelogCard({ editionNumber }: EditionChangelogCardProps) {
  const changelog = getHistoryChangelog(editionNumber);
  if (!changelog) return null;

  return (
    <section className="history-edition-changelog-card" aria-labelledby={`edition-${editionNumber}-changelog-title`}>
      <div className="history-edition-changelog-card-icon" aria-hidden="true">
        <FileClock size={22} />
      </div>
      <div>
        <p className="eyebrow">Changelog</p>
        <h2 id={`edition-${editionNumber}-changelog-title`}>Les notes de mise à jour</h2>
        <p>Retrouvez l’intégralité du changelog publié pour cette édition.</p>
      </div>
      <Link href={`/wiki/changelogs/${editionNumber}`}>
        Lire le changelog <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
