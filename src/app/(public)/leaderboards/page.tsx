import type { Metadata } from "next";
import { BarChart3, CalendarDays, Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Classements",
  description: "Les classements historiques de la Soirée du Grand Poulet.",
};

export default function LeaderboardsPage() {
  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Éditions"
        title="Les performances, dans leur contexte."
        description="Kills, Elo, dégâts et temps de jeu seront consultables édition par édition, sans mélanger les règles ni les équilibrages."
        aside={
          <div className="segmented-preview" aria-label="Catégories prévues">
            <span className="is-selected">Elo</span>
            <span>Kills</span>
            <span>Dégâts</span>
          </div>
        }
      />
      <div className="summary-strip">
        <div>
          <CalendarDays size={18} />
          <span>
            <strong>Édition</strong>
            Sélection historique
          </span>
        </div>
        <div>
          <Trophy size={18} />
          <span>
            <strong>Podiums</strong>
            Par catégorie
          </span>
        </div>
        <div>
          <BarChart3 size={18} />
          <span>
            <strong>Contexte</strong>
            Comparaisons détaillées
          </span>
        </div>
      </div>
      <EmptyState
        icon={Trophy}
        title="Aucune édition publiée"
        description="La structure est prête. Les premiers classements apparaîtront ici après l’import d’un bundle statistique validé."
      />
    </div>
  );
}

