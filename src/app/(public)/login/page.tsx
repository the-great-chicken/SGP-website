import type { Metadata } from "next";
import { ArrowRight, LockKeyhole, MessagesSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion au profil SGP avec Discord.",
};

export default function LoginPage() {
  return (
    <div className="shell auth-page">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Espace joueur</p>
          <h1>Retrouver son profil SGP.</h1>
          <p>La connexion Discord identifiera votre compte, puis le lien vérifié par DiscordSRV permettra de retrouver votre UUID Minecraft.</p>
          <div className="auth-points">
            <span><ShieldCheck size={17} /> Aucun nouveau système de liaison</span>
            <span><LockKeyhole size={17} /> Les réglages privés restent côté serveur</span>
          </div>
        </div>
        <div className="auth-action-panel">
          <span className="discord-mark" aria-hidden="true"><MessagesSquare size={27} /></span>
          <h2>Connexion Discord</h2>
          <p>L’authentification sera activée lorsque la synchronisation DiscordSRV sera prête.</p>
          <button className="button discord-button" type="button" disabled>
            Continuer avec Discord <ArrowRight size={17} />
          </button>
          <Link className="text-link centered" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </div>
  );
}

