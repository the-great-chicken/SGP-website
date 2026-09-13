import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenText,
  Map,
  ScrollText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import { historyEditions } from "@/content/history/editions";

export const metadata: Metadata = {
  title: "Histoire",
  description: "Les éditions, les personnages et les récits de la Soirée du Grand Poulet.",
};

export default function WikiPage() {
  return (
    <div className="shell page-stack wiki-page history-index-page">
      <PageIntro
        eyebrow="Archives de la SGP"
        title="Histoire"
        description="Les parties passent. Les histoires restent. Retrouvez ici ce qui a changé d’une édition à l’autre, ce qui s’est réellement passé et les souvenirs qui ont fini par faire partie de la SGP."
        aside={
          <span className="round-icon large">
            <BookOpenText size={27} />
          </span>
        }
      />

      <section className="history-index-section" id="editions" aria-labelledby="history-editions-title">
        <div className="history-index-heading">
          <div>
            <p className="eyebrow">Chronologie</p>
            <h2 id="history-editions-title">Les éditions</h2>
          </div>
        </div>

        <ol className="history-timeline">
          {historyEditions.map((edition) => {
            const content = (
              <>
                <span className="history-timeline-marker" aria-hidden="true">
                  {String(edition.number).padStart(2, "0")}
                </span>
                <div className="history-timeline-card-copy">
                  <div className="history-timeline-meta">
                    <time dateTime={edition.dateIso}>{edition.dateLabel}</time>
                    {edition.status === "published" ? (
                      <span className="history-status-chip is-live">Disponible</span>
                    ) : (
                      <span className="history-status-chip">Article à venir</span>
                    )}
                  </div>
                  <p className="history-timeline-kicker">{edition.shortTitle}</p>
                  <h3>Édition {edition.number}</h3>
                  {edition.subtitle ? <p className="history-timeline-subtitle">{edition.subtitle}</p> : null}
                  <p className="history-timeline-summary">{edition.summary}</p>
                </div>
                <span className="history-timeline-action" aria-hidden="true">
                  {edition.status === "published" ? <ArrowRight size={18} /> : String(edition.year)}
                </span>
              </>
            );

            return (
              <li className={`history-timeline-item is-${edition.status}`} key={edition.number}>
                {edition.status === "published" ? (
                  <Link className="history-timeline-card" href={`/wiki/editions/${edition.number}`}>
                    {content}
                  </Link>
                ) : (
                  <div className="history-timeline-card">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="history-map-plan" aria-labelledby="history-map-title">
        <div className="history-map-plan-icon" aria-hidden="true">
          <Map size={23} />
        </div>
        <div>
          <p className="eyebrow">Évolution de la carte</p>
          <h2 id="history-map-title">La carte au fil des éditions.</h2>
          <p>
            La future visualisation permettra de comparer les états successifs de l’Arène. La chronologie
            en montrera un aperçu ; une page dédiée permettra ensuite de passer d’une édition à l’autre
            et d’observer précisément ce qui a changé.
          </p>
        </div>
        <span className="history-status-chip">Prévu</span>
      </section>

      <section className="history-next-grid" aria-label="Autres entrées de l’histoire">
        <article className="history-next-card">
          <span className="round-icon"><UsersRound size={19} aria-hidden="true" /></span>
          <p className="eyebrow">Personnages</p>
          <h2>Les figures du récit</h2>
          <p>
            Grand Poulet, Canarchimage, Oielchimiste, Corbeautaniste… leurs histoires seront racontées
            à partir de ce qui a réellement été montré aux joueurs.
          </p>
          <span className="history-status-chip">À venir</span>
        </article>
        <article className="history-next-card">
          <span className="round-icon"><Sparkles size={19} aria-hidden="true" /></span>
          <p className="eyebrow">Le récit jusqu’ici</p>
          <h2>Comprendre la SGP en quelques minutes</h2>
          <p>
            Une lecture courte reliera les quatre éditions et les grandes étapes du lore, sans demander
            de connaître tous les événements ni toutes les statistiques.
          </p>
          <span className="history-status-chip">À venir</span>
        </article>
        <article className="history-next-card">
          <span className="round-icon"><ScrollText size={19} aria-hidden="true" /></span>
          <p className="eyebrow">Archives</p>
          <h2>Les documents d’origine</h2>
          <p>
            Invitations, teasers, présentations, sneak peeks et changelogs resteront accessibles comme
            des objets d’archive, sans alourdir les récits principaux.
          </p>
          <span className="history-status-chip">À venir</span>
        </article>
      </section>
    </div>
  );
}
