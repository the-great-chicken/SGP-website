import type { Metadata } from "next";
import { Search, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Joueurs",
  description: "Retrouver les joueurs et leurs résultats à travers les éditions de la SGP.",
};

export default function PlayersPage() {
  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Profils publics"
        title="Chaque joueur a son parcours."
        description="Un profil reliera l’identité Minecraft aux résultats de chaque édition, tout en conservant le pseudo utilisé à l’époque."
      />
      <div className="player-search" role="search">
        <Search size={19} aria-hidden="true" />
        <input disabled aria-label="Rechercher un joueur" placeholder="Rechercher un pseudo Minecraft…" />
        <span>Bientôt</span>
      </div>
      <EmptyState
        icon={UsersRound}
        title="L’annuaire attend ses premières données"
        description="Les profils seront créés lors de l’import de la première édition publiée. Aucun compte fictif n’est ajouté en attendant."
      />
    </div>
  );
}

