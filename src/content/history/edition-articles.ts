import type { ComponentType } from "react";
import EditionOneArticle from "@/content/history/editions/edition-1.mdx";
import EditionTwoArticle from "@/content/history/editions/edition-2.mdx";

const editionArticles: Partial<Record<number, ComponentType>> = {
  1: EditionOneArticle,
  2: EditionTwoArticle,
};

export function getEditionArticle(number: number) {
  return editionArticles[number] ?? null;
}
