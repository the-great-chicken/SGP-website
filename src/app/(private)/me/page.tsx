import type { Metadata } from "next";
import { ArrowRight, LockKeyhole, Palette, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export default function MyProfilePage() {
  return (
    <div className="shell page-stack private-page">
      <PageIntro
        eyebrow="Espace privé"
        title="Votre profil, vos choix."
        description="Cette page réunira le profil public et les contrôles privés pour les cosmétiques débloqués. Elle ne contient encore aucune donnée utilisateur."
        aside={<span className="status-chip protected"><LockKeyhole size={14} /> Authentification requise</span>}
      />
      <div className="private-layout">
        <aside className="private-sidebar">
          <span className="avatar-placeholder small-avatar"><UserRound size={26} /></span>
          <div>
            <strong>Profil non connecté</strong>
            <span>Discord + Minecraft</span>
          </div>
          <nav aria-label="Sections du profil">
            <span className="is-active"><UserRound size={16} /> Vue d’ensemble</span>
            <span><Palette size={16} /> Cosmétiques</span>
            <span><Sparkles size={16} /> Équipement</span>
          </nav>
        </aside>
        <section className="private-content-card">
          <span className="round-icon large"><ShieldCheck size={27} /></span>
          <p className="eyebrow">Aucune session</p>
          <h2>Connectez-vous pour continuer.</h2>
          <p>Le contenu sensible sera chargé seulement après vérification de la session et de l’identité liée, au plus près de chaque accès aux données.</p>
          <Link className="button primary" href="/login">
            Aller à la connexion <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </div>
  );
}

