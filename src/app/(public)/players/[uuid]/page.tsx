import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  Activity,
  ArrowLeft,
  Boxes,
  CalendarRange,
  ChevronDown,
  Clock3,
  Crosshair,
  Gauge,
  HeartCrack,
  Sparkles,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/page-intro";
import { EmptyState } from "@/components/empty-state";
import { loadPlayerProfile } from "@/db/historical-stats";
import type {
  PlayerAbilityMetric,
  PlayerEditionStats,
  PlayerKitEditionStats,
} from "@/db/historical-stats-query";
import {
  formatCount,
  formatDecimal,
  formatEditionDate,
  formatEditionLabel,
  formatFavoriteKit,
  formatPlaytime,
} from "@/lib/historical-stats";
import { getKitAccent } from "@/lib/kit-manifest";
import { getKitIconSrc } from "@/lib/kit-preview";
import { loadKitManifest } from "@/lib/kits";
import {
  getPlayerKitMetricColor,
  getPlayerKitMetricComparisonLabel,
  getPlayerKitMetricDomains,
  getPlayerKitMetricValues,
  type PlayerKitComparisonMetric,
  type PlayerKitMetricDomains,
} from "@/lib/player-kit-stat-scale";

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
  const [profile, kitManifest] = await Promise.all([
    loadPlayerProfile(uuid),
    loadKitManifest(),
  ]);
  if (!profile) {
    return (
      <div className="shell page-stack player-detail-page">
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
          action={<a className="button ghost" href="/map">Retour à la carte</a>}
        />
      </div>
    );
  }

  const ratio = profile.lifetime.deaths > 0
    ? profile.lifetime.kills / profile.lifetime.deaths
    : null;
  const kitAccents = Object.fromEntries(
    (kitManifest?.kits ?? []).map((kit) => [kit.key, getKitAccent(kit)]),
  );
  const kitIcons = Object.fromEntries(
    (kitManifest?.kits ?? []).map((kit) => [kit.key, getKitIconSrc(kit)]),
  );

  return (
    <div className="shell page-stack player-detail-page">
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
            <EditionCard edition={edition} kitAccents={kitAccents} kitIcons={kitIcons} key={edition.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditionCard({
  edition,
  kitAccents,
  kitIcons,
}: {
  edition: PlayerEditionStats;
  kitAccents: Record<string, string>;
  kitIcons: Record<string, string | null>;
}) {
  const kitMetricDomains = getPlayerKitMetricDomains(edition.kitStats);
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
      {edition.kitStats.length ? (
        <details className="ability-history kit-history">
          <summary className="kit-history-summary">
            <span className="kit-history-summary-title">
              <Boxes size={16} />
              Statistiques par kit
            </span>
            <span className="kit-history-summary-meta">
              {edition.kitStats.length} kit{edition.kitStats.length > 1 ? "s" : ""}
              <ChevronDown className="kit-history-chevron" size={15} aria-hidden="true" />
            </span>
          </summary>
          <div className="kit-history-list">
            {edition.kitStats.map((kit) => (
              <KitStatsGroup
                editionTotalTimeTicks={edition.totalTimeTicks}
                kit={kit}
                accent={kit.kitKey
                  ? (kitAccents[kit.kitKey] ?? "var(--accent-violet)")
                  : "var(--accent-violet)"}
                iconSrc={kit.kitKey ? (kitIcons[kit.kitKey] ?? null) : null}
                metricDomains={kitMetricDomains}
                key={kit.kitId}
              />
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

function KitStatsGroup({
  kit,
  editionTotalTimeTicks,
  accent,
  iconSrc,
  metricDomains,
}: {
  kit: PlayerKitEditionStats;
  editionTotalTimeTicks: number;
  accent: string;
  iconSrc: string | null;
  metricDomains: PlayerKitMetricDomains;
}) {
  const metricValues = getPlayerKitMetricValues(kit);
  const playtimeShare = editionTotalTimeTicks > 0
    ? (kit.totalTimeTicks / editionTotalTimeTicks) * 100
    : 0;
  const label = kit.kitKey
    ? formatFavoriteKit(kit.kitKey)
    : kit.kitId >= 0
      ? `Kit #${kit.kitId}`
      : "Kit non identifié";
  const abilityMetrics = sortAbilityMetrics(kit.abilityMetrics);

  return (
    <section
      className="kit-stat-row"
      style={{ "--ability-group-accent": accent } as CSSProperties}
    >
      <header className="kit-stat-row-heading">
        {iconSrc ? (
          <span className="kit-stat-row-icon" aria-hidden="true">
            <Image src={iconSrc} alt="" width={28} height={28} unoptimized />
          </span>
        ) : (
          <span className="kit-stat-row-icon is-fallback" aria-hidden="true">
            {label.slice(0, 1)}
          </span>
        )}
        <h4>{label}</h4>
      </header>

      <dl className="kit-stat-compact-grid">
        <KitPlaytimeStat
          value={formatPlaytime(kit.totalTimeTicks)}
          share={playtimeShare}
        />
        <ComparableKitStat metric="picks" label="Sélections" value={formatCount(kit.picks)} rawValue={metricValues.picks} domains={metricDomains} />
        <ComparableKitStat metric="kills" label="Éliminations" value={formatCount(kit.kills)} rawValue={metricValues.kills} domains={metricDomains} />
        <ComparableKitStat metric="deaths" label="Morts" value={formatCount(kit.deaths)} rawValue={metricValues.deaths} domains={metricDomains} />
        <ComparableKitStat metric="ratio" label="Ratio E/M" value={metricValues.ratio === null ? "—" : formatDecimal(metricValues.ratio)} rawValue={metricValues.ratio} domains={metricDomains} />
        <ComparableKitStat metric="damageDealt" label="Dégâts infligés" value={formatCount(kit.damageDealt)} rawValue={metricValues.damageDealt} domains={metricDomains} />
        <ComparableKitStat metric="damageReceived" label="Dégâts reçus" value={formatCount(kit.damageReceived)} rawValue={metricValues.damageReceived} domains={metricDomains} />
        <ComparableKitStat metric="damagePerMinute" label="Dégâts/min" value={metricValues.damagePerMinute === null ? "—" : formatDecimal(metricValues.damagePerMinute)} rawValue={metricValues.damagePerMinute} domains={metricDomains} />
      </dl>

      {abilityMetrics.length ? (
        <div className="kit-ability-strip">
          <span className="kit-ability-strip-label">
            <Sparkles size={13} aria-hidden="true" />
            Capacités
          </span>
          <div className="kit-ability-chips">
            {abilityMetrics.map((metric, index) => (
              <AbilityMetricChip
                key={`${metric.name}-${index}`}
                metric={metric}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KitPlaytimeStat({ value, share }: { value: string; share: number }) {
  const clampedShare = Math.min(100, Math.max(0, share));
  return (
    <div className="kit-stat-compact-item kit-playtime-stat">
      <dt>Temps de jeu</dt>
      <dd>
        <span>{value} <small>({formatPlaytimeShare(share)})</small></span>
        <span className="kit-playtime-track" aria-hidden="true">
          <span style={{ width: `${clampedShare}%` }} />
        </span>
      </dd>
    </div>
  );
}

function ComparableKitStat({
  metric,
  label,
  value,
  rawValue,
  domains,
}: {
  metric: PlayerKitComparisonMetric;
  label: string;
  value: string;
  rawValue: number | null;
  domains: PlayerKitMetricDomains;
}) {
  const color = getPlayerKitMetricColor(metric, rawValue, domains[metric]);
  const comparisonLabel = getPlayerKitMetricComparisonLabel(metric, rawValue, domains[metric]);
  return (
    <div className="kit-stat-compact-item">
      <dt>{label}</dt>
      <dd
        className={color ? "is-comparison-colored" : undefined}
        style={color ? { "--kit-stat-value-color": color } as CSSProperties : undefined}
        title={comparisonLabel ?? undefined}
      >
        {value}
        {comparisonLabel ? <span className="sr-only"> — {comparisonLabel}</span> : null}
      </dd>
    </div>
  );
}

function AbilityMetricChip({ metric }: { metric: PlayerAbilityMetric }) {
  const formattedMetric = formatAbilityMetric(metric);
  const description = metric.description?.trim();
  const hasDescription = Boolean(description);

  return (
    <span
      className={`kit-ability-chip${hasDescription ? " has-tooltip" : ""}`}
      tabIndex={hasDescription ? 0 : undefined}
      aria-label={hasDescription ? `${formattedMetric}. ${description}` : undefined}
    >
      {formattedMetric}
      {hasDescription ? (
        <span className="kit-ability-tooltip" aria-hidden="true">
          {description}
        </span>
      ) : null}
    </span>
  );
}

function sortAbilityMetrics(metrics: PlayerAbilityMetric[]) {
  return metrics.toSorted((left, right) => {
    const order = abilityMetricOrder(left.name) - abilityMetricOrder(right.name);
    return order || left.name.localeCompare(right.name, "fr-FR");
  });
}

function formatPlaytimeShare(percentage: number) {
  if (percentage > 0 && percentage < 0.1) return "< 0,1 %";
  return `${formatDecimal(percentage)} %`;
}

function abilityMetricOrder(name: string) {
  const normalized = name.toLocaleLowerCase("en-US");
  if (/\buses?\b/.test(normalized) && !normalized.includes("successful")) return 0;
  if (normalized.includes("successful")) return 1;
  if (normalized.includes("affected")) return 2;
  if (normalized.includes("target") || normalized.includes("lock")) return 3;
  if (normalized.includes("displacement") || normalized.includes("distance")) return 4;
  return 10;
}

function formatAbilityMetric(metric: PlayerAbilityMetric) {
  const value = formatDecimal(metric.value);
  const singular = Math.abs(metric.value) === 1;
  const name = metric.name.toLocaleLowerCase("en-US");
  const unit = metric.displayUnit.toLocaleLowerCase("en-US");
  const displayUnit = singular ? singularAbilityUnit(unit) : unit;

  if (name === unit || name.endsWith(` ${unit}`)) {
    const displayName = singular && name.endsWith(unit)
      ? `${name.slice(0, -unit.length)}${displayUnit}`
      : name;
    return `${value} ${displayName}`;
  }

  return `${value} ${displayUnit} ${name}`.trim();
}

function singularAbilityUnit(unit: string) {
  switch (unit) {
    case "uses": return "use";
    case "players": return "player";
    case "decoys": return "decoy";
    case "seconds": return "second";
    case "blocks": return "block";
    case "hearts": return "heart";
    default: return unit;
  }
}

function nullableDecimal(value: number | null) {
  return value === null ? "—" : formatDecimal(value);
}
