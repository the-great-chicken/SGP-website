import type { Metadata } from "next";
import { Activity, Boxes, LockKeyhole, Trophy, UserRound } from "lucide-react";
import { PageIntro } from "@/components/page-intro";

type PlayerPageProps = {
  params: Promise<{ uuid: string }>;
};

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { uuid } = await params;
  return { title: `Joueur ${shortUuid(uuid)}` };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { uuid } = await params;

  return (
    <div className="shell page-stack">
      <PageIntro
        eyebrow="Profil joueur"
        title="Profil non publié"
        description={`Aucune donnée publique n’est encore associée à l’identifiant ${shortUuid(uuid)}.`}
        aside={<span className="uuid-chip">{uuid}</span>}
      />
      <div className="profile-layout">
        <aside className="profile-identity-card">
          <span className="avatar-placeholder">
            <UserRound size={34} />
          </span>
          <h2>Joueur inconnu</h2>
          <p>Le profil sera automatiquement renseigné par un import d’édition.</p>
        </aside>
        <section className="profile-content">
          <div className="profile-stat-grid">
            <ProfileStat icon={Trophy} label="Elo" />
            <ProfileStat icon={Activity} label="Parties" />
            <ProfileStat icon={Boxes} label="Kit favori" />
          </div>
          <div className="profile-private-note">
            <LockKeyhole size={19} />
            <p>Les statistiques publiques seront séparées des réglages privés et des cosmétiques équipés.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileStat({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <div className="profile-stat">
      <Icon size={18} />
      <strong>—</strong>
      <span>{label}</span>
    </div>
  );
}

function shortUuid(uuid: string) {
  return uuid.length > 12 ? `${uuid.slice(0, 8)}…` : uuid;
}

