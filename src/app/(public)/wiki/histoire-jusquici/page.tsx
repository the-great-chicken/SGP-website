import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";
import StoryArticle from "@/content/history/story.mdx";

export const metadata: Metadata = {
  title: "L’histoire jusqu’ici",
  description: "Le fil narratif qui relie les quatre premières éditions de la Soirée du Grand Poulet.",
};

export default function HistoryStoryPage() {
  return (
    <div className="shell page-stack wiki-page history-story-page history-index-page">
      <PageIntro
        eyebrow={<>
          <Link className="history-breadcrumb-link" href="/wiki">Histoire</Link>
          <span aria-hidden="true"> · </span>
          Le récit
        </>}
        title="L’histoire jusqu’ici"
        description="Le fil rouge des quatre premières éditions : Grand Poulet, Canarchimage, Oielchimiste et Corbeautaniste, sans repasser par tous les événements de chaque soirée."
        aside={
          <span className="round-icon large">
            <Sparkles size={27} />
          </span>
        }
      />
      <StoryArticle />
    </div>
  );
}
