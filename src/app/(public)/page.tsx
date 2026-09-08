import { ArrowRight, Boxes } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { KitCard } from "@/components/kit-card";
import { loadLeaderboard } from "@/db/historical-stats";
import { loadKitStats } from "@/db/kit-stats";
import {
  formatEditionLabel,
  formatLeaderboardValue,
} from "@/lib/historical-stats";
import { compareKits, toKitCardView } from "@/lib/kit-manifest";
import { loadItemImageResolver } from "@/lib/item-renders";
import { loadKitManifest } from "@/lib/kits";

export const dynamic = "force-dynamic";

const loreLinks = [
  {
    href: "/wiki",
    number: "01",
    title: "Les éditions",
    description: "Dates, règles, cartes et moments marquants de chaque édition.",
  },
  {
    href: "/players",
    number: "02",
    title: "Les joueurs",
    description: "Profils, participations et parcours dans les archives de la SGP.",
  },
  {
    href: "/wiki",
    number: "03",
    title: "Les règles et récits",
    description: "Évolutions du jeu, anecdotes et souvenirs qui méritent de rester.",
  },
];

export default async function HomePage() {
  const [manifest, stats, leaderboard] = await Promise.all([
    loadKitManifest(),
    loadKitStats(),
    loadLeaderboard(undefined, "elo"),
  ]);
  const resolveItemImage = manifest
    ? await loadItemImageResolver(manifest)
    : () => null;
  const definitions = (manifest?.kits ?? []).toSorted(compareKits);
  const kits = definitions.map((kit) => toKitCardView(kit, resolveItemImage));
  const leaderboardEntries = leaderboard.entries.slice(0, 5);

  return (
    <>
      <section className="immersive-hero">
        <div className="immersive-hero-art" aria-hidden="true">
          <Image
            src="/media/sgp-landscape.svg"
            alt=""
            fill
            priority
            sizes="(max-width: 720px) 130vw, 85vw"
            unoptimized
          />
        </div>
        <div className="immersive-hero-wide immersive-hero-copy">
          <p className="eyebrow">Minecraft · SGP</p>
          <h1>
            Soirée du
            <span>Grand Poulet.</span>
          </h1>
          <p className="hero-lede">Kits, classements, joueurs, histoire et carte.</p>
        </div>
      </section>

      <div className="home-content shell">
        <section className="home-section" id="kits">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">Équipement et capacités</p>
              <h2>Kits</h2>
            </div>
            <Link className="text-link" href="/kits">
              Tous les kits <ArrowRight size={15} />
            </Link>
          </div>
          {kits.length ? (
            <div className="featured-kits">
              {kits.slice(0, 4).map((kit) => (
                <KitCard
                  kit={kit}
                  stats={stats.byKitKey[kit.key]}
                  statsContext={stats}
                  compact
                  key={kit.key}
                />
              ))}
            </div>
          ) : (
            <div className="inline-notice">
              <Boxes size={19} />
              <p>Les kits seront affichés ici dès que leur manifeste sera disponible.</p>
            </div>
          )}
        </section>

        <section className="home-section home-map-section" id="world">
          <a className="home-map-art" href="/map" aria-label="Ouvrir la carte du serveur">
            <Image
              src="/media/sgp-landscape.svg"
              alt="Aperçu illustré du terrain de la SGP"
              fill
              sizes="(max-width: 820px) 100vw, 60vw"
              unoptimized
            />
            <span className="home-map-label">VUE D’ENSEMBLE</span>
          </a>
          <div className="home-map-copy">
            <p className="eyebrow">Le serveur</p>
            <h2>Carte</h2>
            <p>Consultez le terrain et les points d’intérêt sur la carte interactive du serveur.</p>
            <a className="text-link" href="/map">
              Ouvrir la carte <ArrowRight size={15} />
            </a>
          </div>
        </section>

        <section className="home-section home-ranking-section" id="rankings">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">Résultats par édition</p>
              <h2>Classements</h2>
            </div>
            <Link className="text-link" href="/leaderboards">
              Tableau complet <ArrowRight size={15} />
            </Link>
          </div>

          {leaderboardEntries.length ? (
            <div className="home-ranking-table-scroll">
              <table className="home-ranking-table">
                <thead>
                  <tr>
                    <th scope="col">Rang</th>
                    <th scope="col">Joueur</th>
                    <th scope="col">Elo</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardEntries.map((entry) => (
                    <tr key={entry.playerUuid}>
                      <td className="table-rank">#{entry.rank}</td>
                      <th scope="row">
                        <Link className="table-player" href={`/players/${entry.playerUuid}`}>
                          <span className="player-monogram is-small" aria-hidden="true">
                            {entry.minecraftName.slice(0, 2).toLocaleUpperCase("fr")}
                          </span>
                          <span>
                            <strong>{entry.minecraftName}</strong>
                            {entry.minecraftName !== entry.currentMinecraftName ? (
                              <small>{entry.currentMinecraftName}</small>
                            ) : null}
                          </span>
                        </Link>
                      </th>
                      <td>{formatLeaderboardValue("elo", entry.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="inline-notice">
              <p>Les classements apparaîtront ici après la publication d’une édition.</p>
            </div>
          )}
          {leaderboard.selectedEdition ? (
            <p className="home-ranking-caption">
              Aperçu de {formatEditionLabel(leaderboard.selectedEdition)}.
            </p>
          ) : null}
        </section>

        <section className="home-section home-lore-section" id="stories">
          <div className="section-heading">
            <p className="eyebrow">Archives</p>
            <h2>Histoire de la SGP</h2>
          </div>
          <div className="home-story-list">
            {loreLinks.map((item) => (
              <Link href={item.href} className="home-story-row" key={item.number}>
                <span className="home-story-number">{item.number}</span>
                <span className="home-story-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
