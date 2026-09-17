import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <span className="brand-mark small" aria-hidden="true">
            <SiteLogo />
          </span>
          <div>
            <strong>Soirée du Grand Poulet</strong>
            <p>« Prr-pot-pot… bwaak-cot ! » 🐔</p>
          </div>
        </div>
        <div className="footer-links">
          <Link href="/about">À propos</Link>
          <Link href="/login">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}
