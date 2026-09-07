import type { Metadata } from "next";
import { ArrowRight, Boxes, CalendarRange, Search, Trophy, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";
import { loadPlayerDirectory } from "@/db/historical-stats";
import { formatCount, formatDecimal, formatFavoriteKit } from "@/lib/historical-stats";

export const metadata: Metadata = {
  title: "Joueurs",
  description: "Retrouver les joueurs et leurs résultats à travers les éditions de la SGP.",
};

export const dynamic = "force-dynamic";

type PlayersPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function PlayersPage({ searchParams }: PlayersPageProps) {
  const parameters = await searchParams;
  const search = singleValue(parameters.q) ?? "";
  const directory = await loadPlayerDirectory(search);

  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Profils publics"
        title="Chaque joueur a son parcours."
        description="Retrouvez les identités Minecraft, les participations et les grandes tendances enregistrées au fil des éditions publiques."
        aside={
          <div className="manifest-badge">
            <UsersRound size={17} />
            <span>
              <strong>{formatCount(directory.totalPlayers)} joueurs</strong>
              Dans les archives publiques
            </span>
          </div>
        }
      />

      <form action="/players" className="player-search" method="get" role="search">
        <Search size={19} aria-hidden="true" />
        <input
          aria-label="Rechercher un joueur"
          defaultValue={directory.query}
          maxLength={64}
          name="q"
          placeholder="Rechercher un pseudo ou un ancien pseudo…"
        />
        {directory.query ? (
          <Link className="search-clear" href="/players" aria-label="Effacer la recherche">
            <X size={16} />
          </Link>
        ) : null}
        <button className="button primary compact-button" type="submit">Rechercher</button>
      </form>

      {directory.totalPlayers === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="L’annuaire attend ses premières données"
          description="Les profils seront créés lors de l’import de la première édition publiée. Aucun compte fictif n’est ajouté en attendant."
        />
      ) : directory.players.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Aucun joueur trouvé"
          description={`Aucun joueur ne correspond à « ${directory.query} ».`}
          action={<Link className="button ghost" href="/players">Voir tous les joueurs</Link>}
        />
      ) : (
        <section className="player-directory" aria-label="Joueurs publics">
          <div className="directory-heading">
            <p>
              {directory.query
                ? `${directory.players.length} résultat${directory.players.length > 1 ? "s" : ""}`
                : "Tous les joueurs"}
            </p>
          </div>
          <div className="player-grid">
            {directory.players.map((player) => (
              <Link className="player-card" href={`/players/${player.uuid}`} key={player.uuid}>
                <span className="player-monogram" aria-hidden="true">
                  {player.minecraftName.slice(0, 2).toLocaleUpperCase("fr-FR")}
                </span>
                <div className="player-card-identity">
                  <h2>{player.minecraftName}</h2>
                  <p>
                    {player.aliases.length
                      ? `Aussi connu comme ${player.aliases.slice(0, 2).join(", ")}`
                      : `Dernière apparition : édition ${player.latestEditionNumber}`}
                  </p>
                </div>
                <div className="player-card-stats">
                  <span><CalendarRange size={15} /><strong>{player.appearances}</strong> édition{player.appearances > 1 ? "s" : ""}</span>
                  <span><Trophy size={15} /><strong>{formatCount(player.kills)}</strong> élim.</span>
                  <span><Boxes size={15} /><strong>{formatFavoriteKit(player.favoriteKitKey)}</strong></span>
                </div>
                <div className="player-card-rating">
                  <small>Meilleur Elo</small>
                  <strong>{player.bestRating === null ? "—" : formatDecimal(player.bestRating)}</strong>
                </div>
                <ArrowRight className="player-card-arrow" size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
