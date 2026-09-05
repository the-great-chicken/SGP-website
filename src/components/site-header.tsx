"use client";

import { Bird, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/kits", label: "Kits" },
  { href: "/leaderboards", label: "Classements" },
  { href: "/players", label: "Joueurs" },
  { href: "/wiki", label: "Histoire" },
  { href: "/map/", label: "Carte" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="SGP — Accueil">
          <span className="brand-mark" aria-hidden="true">
            <Bird size={22} strokeWidth={2.3} />
          </span>
          <span className="brand-copy">
            <strong>SGP</strong>
            <small>Les archives</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Navigation principale">
          {navigation.map((item) => {
            const NavigationLink = item.href === "/map/" ? "a" : Link;
            return (
              <NavigationLink
                className={isActive(pathname, item.href) ? "nav-link is-active" : "nav-link"}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </NavigationLink>
            );
          })}
        </nav>

        <Link className="profile-link desktop-profile" href="/me">
          <UserRound size={17} />
          Mon profil
        </Link>

        <button
          className="menu-button"
          type="button"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      <div
        className={menuOpen ? "mobile-menu is-open" : "mobile-menu"}
        id="mobile-navigation"
      >
        <nav className="shell mobile-nav" aria-label="Navigation mobile">
          {navigation.map((item) => {
            const NavigationLink = item.href === "/map/" ? "a" : Link;
            return (
              <NavigationLink
                className={isActive(pathname, item.href) ? "mobile-nav-link is-active" : "mobile-nav-link"}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavigationLink>
            );
          })}
          <Link className="profile-link mobile-profile" href="/me" onClick={() => setMenuOpen(false)}>
            <UserRound size={17} />
            Mon profil
          </Link>
        </nav>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
