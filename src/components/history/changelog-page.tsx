import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { ChangelogToc } from "@/components/history/changelog-toc";
import type { HistoryChangelog } from "@/content/history/changelogs";
import { historyChangelogs } from "@/content/history/changelogs";
import { getHistoryEdition } from "@/content/history/editions";

type ChangelogPageProps = {
  changelog: HistoryChangelog;
  Article: ComponentType;
};

export function ChangelogPage({ changelog, Article }: ChangelogPageProps) {
  return (
    <div className="shell page-stack wiki-page history-changelog-page">
      <header className="history-changelog-hero">
        <div className="history-changelog-backline">
          <Link href={`/wiki/editions/${changelog.edition}`}>
            <ArrowLeft size={14} aria-hidden="true" />
            Retour à l’édition {changelog.edition}
          </Link>
        </div>
        <div className="history-changelog-hero-grid">
          <div className="history-breadcrumb">
            <Link className="history-breadcrumb-link" href="/wiki">Histoire</Link>
            <span aria-hidden="true">/</span>
            <Link href="/wiki/changelogs">Changelog</Link>
            <span aria-hidden="true">/</span>
            <span>Édition {changelog.edition}</span>
          </div>
          <h1>{changelog.title}</h1>
          <p className="history-changelog-subtitle">{changelog.subtitle}</p>
        </div>
      </header>

      <nav className="history-changelog-switcher" aria-label="Choisir un changelog">
        {historyChangelogs.map((item) => {
          const itemEdition = getHistoryEdition(item.edition);
          const active = item.edition === changelog.edition;
          return (
            <Link
              className={active ? "is-active" : undefined}
              href={`/wiki/changelogs/${item.edition}`}
              key={item.edition}
              aria-current={active ? "page" : undefined}
            >
              <span>Édition {item.edition}</span>
              <small>{itemEdition?.dateLabel}</small>
            </Link>
          );
        })}
      </nav>

      <div className="history-changelog-layout">
        <ChangelogToc sections={changelog.sections} />

        <article className="history-changelog-document">
          <Article />
        </article>
      </div>
    </div>
  );
}
