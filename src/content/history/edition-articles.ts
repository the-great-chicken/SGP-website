import type { ComponentType } from "react";
import EditionOneArticle from "@/content/history/editions/edition-1.mdx";

const editionArticles: Partial<Record<number, ComponentType>> = {
  1: EditionOneArticle,
};

export function getEditionArticle(number: number) {
  return editionArticles[number] ?? null;
}
