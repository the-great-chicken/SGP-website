import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { historyCharacters } from "@/content/history/characters";
import { getHistoryEdition } from "@/content/history/editions";

export const metadata: Metadata = {
  title: "Personnages — Histoire",
  description: "Les figures récurrentes de l’histoire de la Soirée du Grand Poulet.",
};

export default function HistoryCharactersPage() {
  return (
    <div className="shell page-stack wiki-page history-index-page history-characters-index-page">
      <PageIntro
        eyebrow={<>
          <Link className="history-breadcrumb-link" href="/wiki">Histoire</Link>
          <span aria-hidden="true"> · </span>
          Personnages
        </>}
        title="Personnages"
        description="Les figures récurrentes de la SGP, séparées des profils de joueurs. Les fiches rassemblent ce qui est déjà établi et laissent volontairement de la place au scénariste pour écrire le reste."
        aside={
          <span className="round-icon large">
            <UsersRound size={27} />
          </span>
        }
      />

      <section className="history-character-index-section" aria-labelledby="history-character-index-title">
        <div className="history-index-heading">
          <div>
            <p className="eyebrow">Fiches</p>
            <h2 id="history-character-index-title">Les figures du récit</h2>
          </div>
          <p>
            Chaque fiche partage la même structure : un grand portrait 16:9, des repères rapides, les faits déjà canonisés et des zones clairement réservées à l’écriture future.
          </p>
        </div>

        <div className="history-character-card-grid">
          {historyCharacters.map((character) => {
            const firstEdition = getHistoryEdition(character.firstAppearance);

            return (
              <Link className="history-character-card" href={`/wiki/personnages/${character.slug}`} key={character.slug}>
                <div className={`history-character-card-portrait${character.portrait.src ? " has-image" : ""}`} aria-hidden="true">
                  {character.portrait.src ? (
                    <Image src={character.portrait.src} alt="" fill sizes="(max-width: 640px) 86px, 138px" />
                  ) : (
                    <span>{character.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="history-character-card-copy">
                  <p className="eyebrow">Première apparition · Édition {character.firstAppearance}</p>
                  <h3>{character.name}</h3>
                  <p className="history-character-card-role">{character.roleLabel}</p>
                  <p>{character.summary}</p>
                  {firstEdition ? <small>{firstEdition.dateLabel}</small> : null}
                </div>
                <ArrowRight className="history-character-card-arrow" size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
