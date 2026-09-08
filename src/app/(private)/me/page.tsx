import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Link2Off, LockKeyhole, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/auth/session";
import { PageIntro } from "@/components/page-intro";
import { CosmeticWardrobe } from "@/components/cosmetic-wardrobe";
import { cosmeticService } from "@/cosmetics/server";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const discordName = session.discord.displayName ?? session.discord.username;
  const cosmetics = session.player ? await cosmeticService.read(session) : null;

  return (
    <div className="shell page-stack private-page">
      <PageIntro
        eyebrow="Espace privé"
        title="Mon profil"
        description={session.player ? "Votre compte Discord est relié à votre identité Minecraft par DiscordSRV." : "Votre identité Discord est confirmée, mais aucune identité Minecraft synchronisée ne correspond encore à ce compte."}
        aside={<span className="status-chip protected"><LockKeyhole size={14} /> Session privée</span>}
      />
      <div className="private-main">
        <section className="private-content-card private-account-card">
          <div className="private-identity-summary">
            <span
              className={session.discord.avatarUrl ? "avatar-placeholder private-identity-avatar discord-avatar" : "avatar-placeholder private-identity-avatar"}
              style={session.discord.avatarUrl ? { backgroundImage: `url(${session.discord.avatarUrl})` } : undefined}
            >
              {session.discord.avatarUrl ? null : <UserRound size={30} />}
            </span>
            <div className="private-identity-copy">
              <div className="private-identity-status">
                <span className="round-icon">{session.player ? <CheckCircle2 size={18} /> : <Link2Off size={18} />}</span>
                <p className="eyebrow">{session.player ? "Identité vérifiée" : "Liaison Minecraft manquante"}</p>
              </div>
              <h2>{session.player ? session.player.minecraftName : discordName}</h2>
              <div className="private-identity-names" aria-label="Identités du compte">
                {session.player && (
                  <span><strong>Minecraft</strong> {session.player.minecraftName}</span>
                )}
                <span>
                  <strong>Discord</strong> {discordName}
                  <small>@{session.discord.username}</small>
                </span>
              </div>
            </div>
          </div>
          {session.player ? (
            <>
              <p>Vos cosmétiques sont associés à ce joueur Minecraft. Retrouvez ci-dessous vos récompenses débloquées et votre équipement.</p>
              <div className="private-account-actions">
                <Link className="button primary" href={`/players/${session.player.uuid}`}>
                  Voir mon profil public <ArrowRight size={17} />
                </Link>
                <LogoutButton />
              </div>
            </>
          ) : (
            <>
              <p>Liez votre compte Minecraft avec la commande et le code DiscordSRV habituels, puis demandez à l’administrateur de resynchroniser <span className="inline-code">accounts.aof</span> et <span className="inline-code">usercache.json</span>. Actualisez ensuite cette page.</p>
              <div className="private-account-actions">
                <Link className="button ghost" href="/players">Chercher mon profil public</Link>
                <LogoutButton />
              </div>
            </>
          )}
        </section>
        {cosmetics && <CosmeticWardrobe initialView={cosmetics} />}
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

