import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Crown, Flag, ScrollText, Swords } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Histoire",
  description: "L’histoire, les éditions et le monde de la Soirée du Grand Poulet.",
};

const chapters = [
  {
    icon: Flag,
    title: "Les éditions",
    description: "Les règles, les cartes et les moments marquants de chaque rassemblement.",
    detail: "Chronologie",
  },
  {
    icon: Crown,
    title: "Figures de la SGP",
    description: "Vainqueurs, organisateurs, rivaux et personnages entrés dans le folklore.",
    detail: "Portraits",
  },
  {
    icon: Swords,
    title: "Kits et métas",
    description: "L’évolution des styles de jeu, des capacités et des grands équilibrages.",
    detail: "Archives de jeu",
  },
  {
    icon: ScrollText,
    title: "Récits et anecdotes",
    description: "Tout ce qui ne tient pas dans une feuille de statistiques, mais mérite de rester.",
    detail: "Mémoire collective",
  },
];

export default function WikiPage() {
  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Histoire & lore"
        title="Ce qui s’est vraiment passé. Et le reste."
        description="Une archive éditoriale des anciennes éditions, écrite en MDX pour mêler récits, profils, cartes et données du site."
        aside={
          <span className="round-icon large">
            <BookOpenText size={27} />
          </span>
        }
      />
      <div className="chapter-grid">
        {chapters.map(({ icon: Icon, title, description, detail }) => (
          <article className="chapter-card" key={title}>
            <span className="round-icon">
              <Icon size={20} />
            </span>
            <span className="chapter-detail">{detail}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="chapter-soon">
              Contenu à venir <ArrowRight size={14} />
            </span>
          </article>
        ))}
      </div>
      <section className="editorial-callout">
        <div>
          <p className="eyebrow">Contribution</p>
          <h2>Une mémoire qui se construit à plusieurs.</h2>
          <p>Les articles resteront versionnés dans le dépôt. Une proposition de correction pourra donc être relue comme n’importe quel changement du site.</p>
        </div>
        <Link className="button ghost" href="/login">
          Se connecter plus tard
        </Link>
      </section>
    </div>
  );
}

