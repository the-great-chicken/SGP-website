import type { Metadata } from "next";
import Image from "next/image";
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

      <section className="history-reading-section" aria-labelledby="history-reading-title">
        <div className="history-index-heading">
          <div>
            <p className="eyebrow">Pour commencer</p>
            <h2 id="history-reading-title">Explorer l’histoire</h2>
          </div>
        </div>

        <div className="history-next-grid">
          <Link className="history-next-card is-link" href="/wiki/histoire-jusquici">
            <span className="round-icon"><Sparkles size={19} aria-hidden="true" /></span>
            <p className="eyebrow">Le récit jusqu’ici</p>
            <h2>Quatre éditions en quelques minutes</h2>
            <p>
              Le fil rouge du Grand Poulet et du Canarchimage, de la première intrusion à la compétition entre deux camps.
            </p>
            <span className="history-card-action">Lire le récit <ArrowRight size={16} /></span>
          </Link>

          <Link className="history-next-card is-link" href="/wiki/changelogs/4">
            <span className="round-icon"><ScrollText size={19} aria-hidden="true" /></span>
            <p className="eyebrow">Changelogs</p>
            <h2>Les notes de mise à jour</h2>
            <p>
              Les changelogs des éditions 2, 3 et 4, pour retrouver les changements apportés aux kits, aux événements, à l’Arène et au serveur.
            </p>
            <span className="history-card-action">Parcourir les changelogs <ArrowRight size={16} /></span>
          </Link>

          <Link className="history-next-card is-link" href="/wiki/personnages">
            <span className="round-icon"><UsersRound size={19} aria-hidden="true" /></span>
            <p className="eyebrow">Personnages</p>
            <h2>Les figures du récit</h2>
            <p>
              Grand Poulet, Canarchimage, Oielchimiste, Corbeautaniste… des fiches séparées des profils joueurs, avec ce qui est déjà établi et de la place pour la suite.
            </p>
            <span className="history-card-action">Voir les personnages <ArrowRight size={16} /></span>
          </Link>
        </div>
      </section>


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
                <div className={`history-timeline-visual${edition.timelineImageSrc ? " has-image" : ""}`}>
                  {edition.timelineImageSrc ? (
                    <Image
                      src={edition.timelineImageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 84px, 132px"
                      loading={edition.number === 1 ? "eager" : "lazy"}
                    />
                  ) : (
                    <div className="history-timeline-visual-placeholder" aria-hidden="true" />
                  )}
                </div>
                <div className="history-timeline-card-copy">
                  <div className="history-timeline-meta">
                    {edition.dateIso ? (
                      <time dateTime={edition.dateIso}>{edition.dateLabel}</time>
                    ) : (
                      <span>{edition.dateLabel}</span>
                    )}
                    {edition.status === "published" ? (
                      <span className="history-status-chip is-live">Disponible</span>
                    ) : (
                      <span className="history-status-chip">À venir</span>
                    )}
                  </div>
                  <p className="history-timeline-kicker">{edition.shortTitle}</p>
                  <h3>Édition {edition.number}</h3>
                  {edition.subtitle ? <p className="history-timeline-subtitle">{edition.subtitle}</p> : null}
                  <p className="history-timeline-summary">{edition.summary}</p>
                </div>
                <span className="history-timeline-action" aria-hidden="true">
                  {edition.status === "published" ? <ArrowRight size={18} /> : (edition.year ?? "???")}
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

      <Link className="history-map-plan is-link" href="/wiki/carte" aria-labelledby="history-map-title">
        <div className="history-map-plan-icon" aria-hidden="true">
          <Map size={23} />
        </div>
        <div>
          <p className="eyebrow">Évolution de la carte</p>
          <h2 id="history-map-title">Comparer l’Arène au fil des éditions.</h2>
          <p>
            Explorez les rendus 3D historiques et passez d’une édition à l’autre sans perdre le lieu que vous êtes en train d’observer.
          </p>
        </div>
        <span className="history-card-action">Explorer la carte <ArrowRight size={16} /></span>
      </Link>
    </div>
  );
}
