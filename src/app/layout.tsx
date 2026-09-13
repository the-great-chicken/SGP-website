import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_LOGO_PATH, SITE_LOGO_SCRIPT } from "@/lib/site-brand";
import "../../public/branding/site-logo.css";
import "./globals.css";
import "./slate.css";

export const metadata: Metadata = {
  title: {
    default: "Soirée du Grand Poulet — SGP",
    template: "%s — SGP",
  },
  description: "Kits, classements, joueurs et histoire de la Soirée du Grand Poulet.",
  icons: {
    icon: SITE_LOGO_PATH,
    shortcut: SITE_LOGO_PATH,
    apple: SITE_LOGO_PATH,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#18252f",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <Script src={SITE_LOGO_SCRIPT} type="module" strategy="afterInteractive" />
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
