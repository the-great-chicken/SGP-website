import { CalendarDays, Gamepad2, MapPinned } from "lucide-react";
import Link from "next/link";
import type { HistoryEdition } from "@/content/history/editions";

type EditionHeroProps = {
  edition: HistoryEdition;
};

export function EditionHero({ edition }: EditionHeroProps) {
  return (
    <header className="history-edition-hero">
      <div className="history-edition-hero-copy">
        <div className="history-breadcrumb">
          <Link className="history-breadcrumb-link" href="/wiki">Histoire</Link>
          <span aria-hidden="true">/</span>
          <span>Édition {edition.number}</span>
        </div>
        <p className="history-edition-kicker">{edition.shortTitle}</p>
        <h1>Édition {edition.number}</h1>
        {edition.subtitle ? <p className="history-edition-subtitle">{edition.subtitle}</p> : null}
        <p className="history-edition-summary">{edition.summary}</p>
        <dl className="history-edition-facts">
          <div>
            <dt><CalendarDays size={15} aria-hidden="true" /> Date</dt>
            <dd><time dateTime={edition.dateIso}>{edition.dateLabel}</time></dd>
          </div>
          <div>
            <dt><MapPinned size={15} aria-hidden="true" /> Lieu</dt>
            <dd>{edition.locationLabel}</dd>
          </div>
          <div>
            <dt><Gamepad2 size={15} aria-hidden="true" /> Minecraft</dt>
            <dd>{edition.minecraftVersion}</dd>
          </div>
        </dl>
      </div>
      <div className="history-edition-mark" aria-hidden="true">
        <span>{String(edition.number).padStart(2, "0")}</span>
        <strong>{edition.year}</strong>
      </div>
    </header>
  );
}
