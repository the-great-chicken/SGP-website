import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SGP — Les archives",
    template: "%s — SGP",
  },
  description: "Kits, classements, joueurs et histoire de la Soirée du Grand Poulet.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#101416",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Aller au contenu
        </a>
        <div className="site-frame">
          <SiteHeader />
          <main id="main-content" className="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
