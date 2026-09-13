import { createElement } from "react";
import EditionOneArticle from "@/content/history/editions/edition-1.mdx";
import EditionTwoArticle from "@/content/history/editions/edition-2.mdx";
import EditionThreeArticle from "@/content/history/editions/edition-3.mdx";
import EditionFourArticle from "@/content/history/editions/edition-4.mdx";
import type { HistoryEdition } from "@/content/history/editions";

type EditionArticleProps = {
  number: HistoryEdition["number"];
};

export function EditionArticle({ number }: EditionArticleProps) {
  switch (number) {
    case 1:
      return createElement(EditionOneArticle);
    case 2:
      return createElement(EditionTwoArticle);
    case 3:
      return createElement(EditionThreeArticle);
    case 4:
      return createElement(EditionFourArticle);
  }
}
