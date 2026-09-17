import type { Metadata } from "next";
import { BookOpenText, Camera, Map, MessageCircle, Music2, Play, Swords, UsersRound } from "lucide-react";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "À propos",
  description: "Présentation de la Soirée du Grand Poulet et liens officiels.",
};

export default function AboutPage() {
  return (
    <div className="shell page-stack about-page">
      <PageIntro
        eyebrow="À propos"
        title="La Soirée du Grand Poulet"
        description="La SGP est une soirée Minecraft PvP construite autour de kits, d’événements, d’une Arène qui évolue et d’une histoire qui se poursuit d’édition en édition. Ce site rassemble les règles du jeu, les résultats et les archives de l’événement au même endroit."
      />

      <section className="about-overview" aria-labelledby="about-overview-title">
        <div className="about-section-heading">
          <p className="eyebrow">L’événement</p>
          <h2 id="about-overview-title">Compétition, exploration et histoire</h2>
        </div>
        <div className="about-feature-grid">
          <article>
            <Swords size={20} aria-hidden="true" />
            <h3>Des kits à maîtriser</h3>
            <p>Chaque kit combine un équipement et une capacité propres, avec des statistiques issues de la dernière édition disponible.</p>
          </article>
          <article>
            <Map size={20} aria-hidden="true" />
            <h3>Une Arène qui évolue</h3>
            <p>La carte change au fil des éditions. Les archives 3D permettent de comparer les mêmes lieux d’une version à l’autre.</p>
          </article>
          <article>
            <BookOpenText size={20} aria-hidden="true" />
            <h3>Un récit continu</h3>
            <p>Les personnages, les quêtes et les événements de chaque soirée alimentent une histoire commune conservée dans les archives.</p>
          </article>
          <article>
            <UsersRound size={20} aria-hidden="true" />
            <h3>Une communauté</h3>
            <p>Les profils joueurs, participations et classements gardent une trace des personnes qui ont pris part à la SGP.</p>
          </article>
        </div>
      </section>

      <section className="about-links" aria-labelledby="about-links-title">
        <div className="about-section-heading">
          <p className="eyebrow">Liens</p>
          <h2 id="about-links-title">Retrouver la SGP</h2>
        </div>
        <div className="about-link-list">
          <a href="https://www.youtube.com/@Soir%C3%A9eduGrandPoulet" target="_blank" rel="noreferrer">
            <Play size={20} aria-hidden="true" />
            <span>
              <strong>YouTube</strong>
              <small>Retrouver nos vidéos</small>
            </span>
          </a>
          <a href="https://discord.gg/SpZAuPVFBH" target="_blank" rel="noreferrer">
            <MessageCircle size={20} aria-hidden="true" />
            <span>
              <strong>Discord</strong>
              <small>Rejoindre la communauté SGP</small>
            </span>
          </a>
          <a href="https://www.instagram.com/soireedugrandpoulet/" target="_blank" rel="noreferrer">
            <Camera size={20} aria-hidden="true" />
            <span>
              <strong>Instagram</strong>
              <small>Suivre la SGP sur Instagram</small>
            </span>
          </a>
          <a href="https://www.tiktok.com/@le.grand.poulet" target="_blank" rel="noreferrer">
            <Music2 size={20} aria-hidden="true" />
            <span>
              <strong>TikTok</strong>
              <small>Retrouver nos vidéos sur TikTok</small>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
