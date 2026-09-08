import type { Metadata } from "next";
import {
  Activity,
  ArrowLeft,
  Boxes,
  CalendarRange,
  Clock3,
  Crosshair,
  Gauge,
  HeartCrack,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/empty-state";
import { loadPlayerProfile } from "@/db/historical-stats";
import type { PlayerEditionStats } from "@/db/historical-stats-query";
import {
  formatCount,
  formatDecimal,
  formatEditionDate,
  formatEditionLabel,
  formatFavoriteKit,
  formatPlaytime,
} from "@/lib/historical-stats";

type PlayerPageProps = {
  params: Promise<{ uuid: string }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { uuid } = await params;
  if (!uuidPattern.test(uuid)) return { title: "Joueur introuvable" };
  const profile = await loadPlayerProfile(uuid);
  return profile
    ? {
        title: profile.currentMinecraftName,
        description: `Statistiques historiques de ${profile.currentMinecraftName} à la SGP.`,
      }
    : { title: "Profil joueur", robots: { index: false, follow: true } };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { uuid } = await params;
  if (!uuidPattern.test(uuid)) notFound();
  const profile = await loadPlayerProfile(uuid);
  if (!profile) {
    return (
      <div className="shell page-stack">
        <Link className="back-link" href="/players">
          <ArrowLeft size={16} /> Tous les joueurs
        </Link>
        <PageIntro
          eyebrow="Profil joueur"
          title="Profil joueur"
          description="Les profils retracent les éditions dont les statistiques ont été publiées."
        />
        <EmptyState
          icon={CalendarRange}
          title="Aucune statistique publiée pour ce joueur."
          description="Son profil se remplira lorsque les résultats d’une édition à laquelle il a participé seront publiés."
          action={<a className="button ghost" href="/map/">Retour à la carte</a>}
        />
      </div>
    );
  }

  const ratio = profile.lifetime.deaths > 0
    ? profile.lifetime.kills / profile.lifetime.deaths
    : null;

  return (
    <div className="shell page-stack">
      <Link className="back-link" href="/players">
        <ArrowLeft size={16} /> Tous les joueurs
      </Link>
      <PageIntro
        eyebrow="Profil joueur"
        title={profile.currentMinecraftName}
        description={profile.firstEditionNumber === profile.latestEditionNumber
          ? `Édition ${profile.firstEditionNumber}.`
          : `De l’édition ${profile.firstEditionNumber} à l’édition ${profile.latestEditionNumber}.`}
      />

      <div className="profile-layout historical-profile">
        <aside className="profile-identity-card">
          <span className="player-monogram profile-monogram" aria-hidden="true">
            {profile.currentMinecraftName.slice(0, 2).toLocaleUpperCase("fr-FR")}
          </span>
          <h2>{profile.currentMinecraftName}</h2>
          <div className="identity-facts">
            <span>
              <CalendarRange size={16} />
              <strong>{profile.lifetime.appearances}</strong>
              édition{profile.lifetime.appearances > 1 ? "s" : ""}
            </span>
            <span>
              <Boxes size={16} />
              <strong>{formatFavoriteKit(profile.lifetime.favoriteKitKey)}</strong>
              kit le plus joué
            </span>
          </div>
          {profile.aliases.length ? (
            <div className="alias-list">
              <span>Pseudos archivés</span>
              {profile.aliases.map((alias) => <strong key={alias}>{alias}</strong>)}
            </div>
          ) : null}
        </aside>

        <section className="profile-content">
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">Toute la carrière</p>
              <h2>Vue d’ensemble</h2>
            </div>
            <span>{profile.lifetime.picks} sélections enregistrées</span>
          </div>
          <div className="profile-stat-grid expanded-stat-grid">
            <ProfileStat icon={Trophy} label="Meilleur Elo" value={nullableDecimal(profile.lifetime.bestRating)} detail={profile.lifetime.latestRating === null ? "Aucun classement" : `${formatDecimal(profile.lifetime.latestRating)} au dernier classement`} />
            <ProfileStat icon={Crosshair} label="Éliminations" value={formatCount(profile.lifetime.kills)} detail={ratio === null ? "Ratio E/M —" : `Ratio E/M ${formatDecimal(ratio)}`} />
            <ProfileStat icon={HeartCrack} label="Morts" value={formatCount(profile.lifetime.deaths)} detail={`${formatCount(profile.lifetime.damageReceived)} dégâts reçus`} />
            <ProfileStat icon={Gauge} label="Dégâts infligés" value={formatCount(profile.lifetime.damageDealt)} detail="Hors auto-dégâts" />
            <ProfileStat icon={Clock3} label="Temps de jeu" value={formatPlaytime(profile.lifetime.totalTimeTicks)} detail={`${profile.lifetime.picks} sélections`} />
            <ProfileStat icon={Boxes} label="Kit favori" value={formatFavoriteKit(profile.lifetime.favoriteKitKey)} detail="Selon le temps de jeu cumulé" />
          </div>
        </section>
      </div>

      <section className="edition-history" aria-labelledby="edition-history-title">
        <div className="section-heading split-heading compact-heading">
          <div>
            <p className="eyebrow">Chronologie</p>
            <h2 id="edition-history-title">Édition par édition.</h2>
          </div>
          <span className="leaderboard-count">{profile.editions.length} participations</span>
        </div>
        <div className="edition-timeline">
          {profile.editions.map((edition) => (
            <EditionCard edition={edition} key={edition.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditionCard({ edition }: { edition: PlayerEditionStats }) {
  const ratio = edition.deaths > 0 ? edition.kills / edition.deaths : null;
  return (
    <article className="edition-card">
      <header>
        <span className="edition-number">#{edition.number}</span>
        <div>
          <h3>{formatEditionLabel(edition)}</h3>
          <p>
            {formatEditionDate(edition.startsAt) ?? "Date non renseignée"}
            {` · sous le pseudo ${edition.minecraftNameAtEvent}`}
          </p>
        </div>
        <div className="edition-rating">
          <small>Elo final</small>
          <strong>{nullableDecimal(edition.rating)}</strong>
          <span>{edition.rank === null ? "Non classé" : `${edition.rank}${edition.rank === 1 ? "er" : "e"}`}</span>
        </div>
      </header>
      <div className="edition-stat-grid">
        <EditionStat label="Éliminations" value={formatCount(edition.kills)} detail={ratio === null ? "Ratio —" : `Ratio ${formatDecimal(ratio)}`} />
        <EditionStat label="Morts" value={formatCount(edition.deaths)} detail={`${formatCount(edition.damageReceived)} dégâts reçus`} />
        <EditionStat label="Dégâts" value={formatCount(edition.damageDealt)} detail="Infligés aux autres joueurs" />
        <EditionStat label="Temps de jeu" value={formatPlaytime(edition.totalTimeTicks)} detail={`${edition.picks} sélections`} />
        <EditionStat label="Kit favori" value={formatFavoriteKit(edition.favoriteKitKey)} detail="Selon le temps de jeu" />
        <EditionStat label="Rencontres Elo" value={formatCount(edition.ratedEncounters)} detail={edition.rating === null ? "Non classé" : "Prises en compte"} />
      </div>
      {edition.abilityMetrics.length ? (
        <details className="ability-history">
          <summary><Sparkles size={16} /> Statistiques de capacités <span>{edition.abilityMetrics.length}</span></summary>
          <div className="ability-history-grid">
            {edition.abilityMetrics.map((metric, index) => (
              <div key={`${metric.kitKey ?? "unknown"}-${metric.name}-${index}`} title={metric.description}>
                <span>{metric.kitKey ? `${formatFavoriteKit(metric.kitKey)} · ` : ""}{metric.name}</span>
                <strong>{formatDecimal(metric.value)} {metric.displayUnit}</strong>
                {metric.description ? <p>{metric.description}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function ProfileStat({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <div className="profile-stat">
      <span className="profile-stat-label"><Icon size={18} /> {label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EditionStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function nullableDecimal(value: number | null) {
  return value === null ? "—" : formatDecimal(value);
}
