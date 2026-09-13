import type { ComponentType } from "react";
import GrandPouletArticle from "@/content/history/characters/grand-poulet.mdx";
import CanarchimageArticle from "@/content/history/characters/canarchimage.mdx";
import OielchimisteArticle from "@/content/history/characters/oielchimiste.mdx";
import CorbeautanisteArticle from "@/content/history/characters/corbeautaniste.mdx";
import type { HistoryCharacterSlug } from "@/content/history/characters";

const characterArticles: Record<HistoryCharacterSlug, ComponentType> = {
  "grand-poulet": GrandPouletArticle,
  canarchimage: CanarchimageArticle,
  oielchimiste: OielchimisteArticle,
  corbeautaniste: CorbeautanisteArticle,
};

export function getCharacterArticle(slug: string) {
  return characterArticles[slug as HistoryCharacterSlug] ?? null;
}
