import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Link2Off, LockKeyhole, LogOut, Palette, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/auth/session";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const discordName = session.discord.displayName ?? session.discord.username;

  return (
    <div className="shell page-stack private-page">
      <PageIntro
        eyebrow="Espace privé"
        title={session.player ? `Bienvenue, ${session.player.minecraftName}.` : `Bienvenue, ${discordName}.`}
        description={session.player ? "Votre compte Discord est relié à votre identité Minecraft par DiscordSRV." : "Votre identité Discord est confirmée, mais DiscordSRV ne la relie encore à aucun joueur connu du site."}
        aside={<span className="status-chip protected"><LockKeyhole size={14} /> Session privée</span>}
      />
      <div className="private-layout">
        <aside className="private-sidebar">
          <span
            className={session.discord.avatarUrl ? "avatar-placeholder small-avatar discord-avatar" : "avatar-placeholder small-avatar"}
            style={session.discord.avatarUrl ? { backgroundImage: `url(${session.discord.avatarUrl})` } : undefined}
          >
            {session.discord.avatarUrl ? null : <UserRound size={26} />}
          </span>
          <div>
            <strong>{discordName}</strong>
            <span>@{session.discord.username}</span>
          </div>
          <nav aria-label="Sections du profil">
            <span className="is-active"><UserRound size={16} /> Vue d’ensemble</span>
            <span><Palette size={16} /> Cosmétiques</span>
            <span><Sparkles size={16} /> Équipement</span>
          </nav>
        </aside>
        <section className="private-content-card private-account-card">
          <span className="round-icon large">{session.player ? <CheckCircle2 size={27} /> : <Link2Off size={27} />}</span>
          <p className="eyebrow">{session.player ? "Identité vérifiée" : "Liaison Minecraft manquante"}</p>
          <h2>{session.player ? session.player.minecraftName : "Terminez la liaison dans DiscordSRV."}</h2>
          {session.player ? (
            <>
              <p>Le profil privé utilise l’UUID <span className="inline-code">{session.player.uuid}</span>. Les futurs réglages de cosmétiques seront toujours appliqués à cette identité.</p>
              <div className="private-account-actions">
                <Link className="button primary" href={`/players/${session.player.uuid}`}>
                  Voir mon profil public <ArrowRight size={17} />
                </Link>
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <p>Liez votre compte Minecraft avec la commande et le code DiscordSRV habituels, puis demandez à l’administrateur de resynchroniser <span className="inline-code">accounts.aof</span>. Reconnectez-vous ensuite ici.</p>
              <div className="private-account-actions">
                <Link className="button ghost" href="/players">Chercher mon profil public</Link>
                <LogoutButton />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="button ghost" type="submit"><LogOut size={16} /> Se déconnecter</button>
    </form>
  );
}

