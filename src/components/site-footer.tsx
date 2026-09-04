import { Bird } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <span className="brand-mark small" aria-hidden="true">
            <Bird size={18} />
          </span>
          <div>
            <strong>Soirée du Grand Poulet</strong>
            <p>Les parties passent. Les histoires restent.</p>
          </div>
        </div>
        <div className="footer-links">
          <Link href="/wiki">À propos</Link>
          <Link href="/kits">Explorer les kits</Link>
          <Link href="/login">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}
