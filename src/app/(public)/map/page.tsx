import type { Metadata } from "next";
import { Compass, Layers3, Map, Radio, ScanLine } from "lucide-react";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Carte",
  description: "La carte 3D de la Soirée du Grand Poulet.",
};

export default function MapPage() {
  return (
    <div className="shell page-stack map-page">
      <PageIntro
        eyebrow="BlueMap"
        title="Le terrain, vu d’en haut."
        description="Cette route accueillera la carte 3D et les joueurs en direct sans reconstruire un moteur de rendu Minecraft dans le site."
        aside={<span className="status-chip muted"><span /> Hors ligne</span>}
      />
      <section className="map-placeholder">
        <div className="map-grid-lines" />
        <div className="map-contour contour-one" />
        <div className="map-contour contour-two" />
        <span className="map-pin pin-one"><Compass size={17} /></span>
        <span className="map-pin pin-two"><Map size={17} /></span>
        <div className="map-message">
          <span className="round-icon large"><ScanLine size={27} /></span>
          <p className="eyebrow">Connexion en attente</p>
          <h2>BlueMap prendra place ici.</h2>
          <p>L’intégration finale conservera cette navigation autour de la carte et délèguera le rendu du monde à BlueMap.</p>
        </div>
        <div className="map-tools" aria-label="Fonctions prévues">
          <span><Layers3 size={16} /> Calques</span>
          <span><Radio size={16} /> Joueurs en direct</span>
        </div>
      </section>
    </div>
  );
}

