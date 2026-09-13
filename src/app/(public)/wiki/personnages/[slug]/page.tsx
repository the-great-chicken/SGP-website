import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CharacterHero } from "@/components/history/character-hero";
import { CharacterInfobox } from "@/components/history/character-infobox";
import { CharacterArticle } from "@/content/history/character-articles";
import { getHistoryCharacter, historyCharacters } from "@/content/history/characters";

export const dynamicParams = false;

type CharacterPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return historyCharacters.map((character) => ({ slug: character.slug }));
}

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const character = getHistoryCharacter(slug);

  if (!character) return {};

  return {
    title: `${character.name} — Personnages`,
    description: character.summary,
  };
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { slug } = await params;
  const character = getHistoryCharacter(slug);
  if (!character) notFound();

  return (
    <div className="shell page-stack wiki-page history-character-page">
      <CharacterHero character={character} />
      <div className="history-character-layout">
        <article className="history-character-article">
          <CharacterArticle slug={character.slug} />
        </article>
        <CharacterInfobox character={character} />
      </div>
    </div>
  );
}
