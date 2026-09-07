import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDiscordAuthConfig } from "@/auth/discord";
import { getCurrentSession } from "@/auth/session";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion au profil SGP avec Discord.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

const errorMessages: Record<string, string> = {
  denied: "La connexion Discord a été annulée.",
  invalid_state: "La demande de connexion a expiré. Veuillez réessayer.",
  oauth_failed: "Discord n’a pas pu confirmer votre identité. Veuillez réessayer.",
  not_configured: "La connexion Discord n’est pas encore configurée sur ce serveur.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, parameters] = await Promise.all([getCurrentSession(), searchParams]);
  if (session) redirect("/me");
  const configured = getDiscordAuthConfig() !== null;
  const errorKey = Array.isArray(parameters.error) ? parameters.error[0] : parameters.error;
  const errorMessage = errorKey ? errorMessages[errorKey] : null;

  return (
    <div className="shell auth-page">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Espace joueur</p>
          <h1>Retrouver son profil SGP.</h1>
          <p>Connectez-vous avec le compte Discord lié à votre joueur Minecraft pour retrouver votre profil et personnaliser vos cosmétiques.</p>
        </div>
        <div className="auth-action-panel">
          <span className="discord-mark" aria-hidden="true"><MessagesSquare size={27} /></span>
          <h2>Connexion Discord</h2>
          <p>Nous demandons uniquement votre identité Discord. Le site ne reçoit jamais votre mot de passe et ne conserve pas le jeton Discord.</p>
          {errorMessage ? <p className="auth-alert"><AlertTriangle size={16} /> {errorMessage}</p> : null}
          {configured ? (
            <a className="button discord-button" href="/api/auth/discord">
              Continuer avec Discord <ArrowRight size={17} />
            </a>
          ) : (
            <span className="button discord-button is-disabled" aria-disabled="true">
              Connexion indisponible
            </span>
          )}
          <Link className="text-link centered" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </div>
  );
}

