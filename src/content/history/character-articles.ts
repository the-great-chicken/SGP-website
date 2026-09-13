import { createElement } from "react";
import GrandPouletArticle from "@/content/history/characters/grand-poulet.mdx";
import CanarchimageArticle from "@/content/history/characters/canarchimage.mdx";
import OielchimisteArticle from "@/content/history/characters/oielchimiste.mdx";
import CorbeautanisteArticle from "@/content/history/characters/corbeautaniste.mdx";
import type { HistoryCharacterSlug } from "@/content/history/characters";

type CharacterArticleProps = {
  slug: HistoryCharacterSlug;
};

export function CharacterArticle({ slug }: CharacterArticleProps) {
  switch (slug) {
    case "grand-poulet":
      return createElement(GrandPouletArticle);
    case "canarchimage":
      return createElement(CanarchimageArticle);
    case "oielchimiste":
      return createElement(OielchimisteArticle);
    case "corbeautaniste":
      return createElement(CorbeautanisteArticle);
  }
}
