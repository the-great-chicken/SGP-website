import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditionHero } from "@/components/history/edition-hero";
import { EditionNavigation } from "@/components/history/edition-navigation";
import { getEditionArticle } from "@/content/history/edition-articles";
import { getHistoryEdition, publishedHistoryEditions } from "@/content/history/editions";

export const dynamicParams = false;

type EditionPageProps = {
  params: Promise<{ edition: string }>;
};

export function generateStaticParams() {
  return publishedHistoryEditions().map((edition) => ({ edition: String(edition.number) }));
}

export async function generateMetadata({ params }: EditionPageProps): Promise<Metadata> {
  const { edition: rawEdition } = await params;
  const edition = getHistoryEdition(Number(rawEdition));

  if (!edition || edition.status !== "published") return {};

  return {
    title: `Édition ${edition.number} — ${edition.shortTitle}`,
    description: edition.summary,
  };
}

export default async function EditionPage({ params }: EditionPageProps) {
  const { edition: rawEdition } = await params;
  const edition = getHistoryEdition(Number(rawEdition));
  const Article = edition ? getEditionArticle(edition.number) : null;

  if (!edition || edition.status !== "published" || !Article) notFound();

  return (
    <div className="shell page-stack wiki-page history-edition-page">
      <EditionHero edition={edition} />
      <Article />
      <EditionNavigation editionNumber={edition.number} />
    </div>
  );
}
