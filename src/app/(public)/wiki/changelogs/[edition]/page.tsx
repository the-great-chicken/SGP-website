import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChangelogPage } from "@/components/history/changelog-page";
import { getChangelogArticle } from "@/content/history/changelog-articles";
import { getHistoryChangelog, historyChangelogs } from "@/content/history/changelogs";

export const dynamicParams = false;

type ChangelogRouteProps = {
  params: Promise<{ edition: string }>;
};

export function generateStaticParams() {
  return historyChangelogs.map((changelog) => ({ edition: String(changelog.edition) }));
}

export async function generateMetadata({ params }: ChangelogRouteProps): Promise<Metadata> {
  const { edition: rawEdition } = await params;
  const changelog = getHistoryChangelog(Number(rawEdition));
  if (!changelog) return {};

  return {
    title: `Changelog — Édition ${changelog.edition}`,
    description: `Notes de mise à jour de l’édition ${changelog.edition} de la SGP.`,
  };
}

export default async function ChangelogRoute({ params }: ChangelogRouteProps) {
  const { edition: rawEdition } = await params;
  const changelog = getHistoryChangelog(Number(rawEdition));
  const Article = changelog ? getChangelogArticle(changelog.edition) : null;

  if (!changelog || !Article) notFound();

  return <ChangelogPage changelog={changelog} Article={Article} />;
}
