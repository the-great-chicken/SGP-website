import {
  ArrowRight,
  BookOpenText,
  Boxes,
  Map,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { KitCard } from "@/components/kit-card";
import { loadKitStats } from "@/db/kit-stats";
import { compareKits, toKitCardView } from "@/lib/kit-manifest";
import { loadItemImageResolver } from "@/lib/item-renders";
import { loadKitManifest } from "@/lib/kits";

export const dynamic = "force-dynamic";

const destinations = [
  {
    href: "/leaderboards",
    icon: Trophy,
    title: "Classements",
    description: "Retrouver les résultats de chaque édition, des podiums aux rivalités.",
  },
  {
    href: "/players",
    icon: UsersRound,
    title: "Joueurs",
    description: "Parcourir les profils, les kits favoris et les parcours au fil des éditions.",
  },
  {
    href: "/wiki",
    icon: BookOpenText,
    title: "Histoire",
    description: "Revirements, personnages et petits drames qui ont construit la légende.",
  },
  {
    href: "/map",
    icon: Map,
    title: "Carte",
    description: "Explorer le terrain de jeu en trois dimensions grâce à BlueMap.",
  },
];

export default async function HomePage() {
  const [manifest, stats] = await Promise.all([loadKitManifest(), loadKitStats()]);
  const resolveItemImage = manifest
    ? await loadItemImageResolver(manifest)
    : () => null;
  const definitions = (manifest?.kits ?? []).toSorted(compareKits);
  const kits = definitions.map((kit) => toKitCardView(kit, resolveItemImage));
  const operationCount = definitions.reduce((sum, kit) => sum + kit.operations.length, 0);

  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <Sparkles size={14} /> La mémoire de la SGP
          </p>
          <h1>
            Chaque édition laisse
            <span> une histoire.</span>
          </h1>
          <p className="hero-lede">
            Kits, performances, rivalités et souvenirs de la Soirée du Grand Poulet réunis dans un seul endroit.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/kits">
              Explorer les kits <ArrowRight size={17} />
            </Link>
            <Link className="button ghost" href="/wiki">
              Découvrir l’histoire
            </Link>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="Aperçu des archives">
          <div className="dashboard-orbit orbit-one" />
          <div className="dashboard-orbit orbit-two" />
          <div className="dashboard-card main-card">
            <div className="dashboard-card-header">
              <span className="live-dot" />
              Archives en construction
            </div>
            <strong>{kits.length || "—"}</strong>
            <span>kits documentés</span>
            <div className="dashboard-bars" aria-hidden="true">
              {[62, 84, 46, 72, 94, 68, 80].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="dashboard-card floating-card top-card">
            <ShieldCheck size={18} />
            <span>
              <strong>26.1</strong>
              Version Minecraft
            </span>
          </div>
          <div className="dashboard-card floating-card bottom-card">
            <Boxes size={18} />
            <span>
              <strong>{operationCount || "—"}</strong>
              éléments de loadout
            </span>
          </div>
        </div>
      </section>

      <section className="home-section shell">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">L’arsenal</p>
            <h2>Treize façons de jouer.</h2>
          </div>
          <Link className="text-link" href="/kits">
            Tous les kits <ArrowRight size={15} />
          </Link>
        </div>
        {kits.length ? (
          <div className="featured-kits">
            {kits.slice(0, 3).map((kit) => (
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
            <p>Le manifeste local des kits n’est pas encore disponible. Lancez l’exporteur pour alimenter cette section.</p>
          </div>
        )}
      </section>

      <section className="home-section section-wash">
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">Tout au même endroit</p>
            <h2>Plus qu’un tableau des scores.</h2>
            <p>Une porte d’entrée vers tout ce qui compose une édition de la SGP.</p>
          </div>
          <div className="destination-grid">
            {destinations.map(({ href, icon: Icon, title, description }, index) => (
              <Link className="destination-card" href={href} key={href}>
                <span className="destination-number">0{index + 1}</span>
                <span className="destination-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <ArrowRight className="destination-arrow" size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

