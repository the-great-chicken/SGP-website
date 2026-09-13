import type { ComponentType } from "react";
import EditionOneArticle from "@/content/history/editions/edition-1.mdx";
import EditionTwoArticle from "@/content/history/editions/edition-2.mdx";
import EditionThreeArticle from "@/content/history/editions/edition-3.mdx";
import EditionFourArticle from "@/content/history/editions/edition-4.mdx";

const editionArticles: Partial<Record<number, ComponentType>> = {
  1: EditionOneArticle,
  2: EditionTwoArticle,
  3: EditionThreeArticle,
  4: EditionFourArticle,
};

export function getEditionArticle(number: number) {
  return editionArticles[number] ?? null;
}
