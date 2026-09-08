import { siteNavigation } from "./site-navigation";

const MAP_STYLESHEET = "/bluemap/sgp.css";
const MAP_FAVICON = "/bluemap/sgp.svg";
const MAP_BASE = "/map/";

const MAP_SHELL_BOOTSTRAP = String.raw`
(() => {
  const root = document.documentElement;
  const label = document.querySelector(".sgp-map-loading-label");
  let frame = 0;
  let settled = false;

  const reveal = () => {
    if (settled) return;
    settled = true;
    cancelAnimationFrame(frame);
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("sgp-map-ready")));
  };

  const showLoadError = () => {
    if (settled) return;
    settled = true;
    cancelAnimationFrame(frame);
    root.classList.add("sgp-map-load-error");
    if (label) label.textContent = "La carte n'a pas pu se charger";
  };

  const inspectBlueMapState = () => {
    const viewer = window.bluemap?.mapViewer;
    const state = viewer?.data?.mapState;
    if (state === "loaded" || viewer?.map?.isLoaded === true) {
      reveal();
      return;
    }
    if (state === "errored") {
      showLoadError();
      return;
    }
    frame = requestAnimationFrame(inspectBlueMapState);
  };

  frame = requestAnimationFrame(inspectBlueMapState);
  window.addEventListener("pagehide", () => cancelAnimationFrame(frame), { once: true });
})();
`;

const CRITICAL_STYLE = String.raw`
@view-transition { navigation: auto; }
:root { color-scheme: dark; }
html.sgp-map,
html.sgp-map body {
  margin: 0;
  min-height: 100%;
  background: #18252f;
  color: #edf1ee;
}
html.sgp-map body {
  min-height: 100vh;
  overflow: hidden;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
html.sgp-map .sgp-map-header { view-transition-name: sgp-site-header; }
html.sgp-map .sgp-map-loading {
  position: fixed;
  inset: calc(88px + env(safe-area-inset-top)) 0 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  background: #18252f;
  opacity: 1;
  visibility: visible;
  transition: opacity 180ms ease, visibility 0s linear 180ms;
  pointer-events: none;
}
html.sgp-map.sgp-map-ready .sgp-map-loading {
  opacity: 0;
  visibility: hidden;
}
html.sgp-map.sgp-map-load-error .sgp-map-loading-line::after {
  width: 100%;
  background: #ef8c82;
  animation: none;
  transform: none;
}
html.sgp-map .sgp-map-loading-mark {
  width: min(220px, calc(100vw - 48px));
  display: grid;
  gap: 12px;
  color: #afbdc7;
  font: 650 13px/1.35 "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  letter-spacing: .08em;
  text-align: center;
  text-transform: uppercase;
}
html.sgp-map .sgp-map-loading-line {
  height: 1px;
  overflow: hidden;
  background: rgba(255, 255, 255, .15);
}
html.sgp-map .sgp-map-loading-line::after {
  width: 38%;
  height: 100%;
  display: block;
  background: #b5d7ed;
  content: "";
  animation: sgp-map-loading 1.05s ease-in-out infinite;
}
@keyframes sgp-map-loading {
  from { transform: translateX(-110%); }
  to { transform: translateX(365%); }
}
@media (max-width: 820px) {
  html.sgp-map .sgp-map-loading { inset-block-start: calc(72px + env(safe-area-inset-top)); }
}
@media (max-width: 600px) {
  html.sgp-map .sgp-map-loading { inset-block-start: calc(68px + env(safe-area-inset-top)); }
}
@media (prefers-reduced-motion: reduce) {
  html.sgp-map .sgp-map-loading-line::after { animation: none; transform: none; width: 100%; }
  html.sgp-map .sgp-map-loading { transition: none; }
}
`;

export function injectBlueMapShell(source: string): string {
  if (!/<html\b/i.test(source) || !/<head\b/i.test(source) || !/<\/head>/i.test(source) || !/<body\b/i.test(source) || !/<\/body>/i.test(source)) {
    throw new Error("BlueMap returned an unexpected HTML document");
  }

  let html = source;
  html = html.replace(/<base\b[^>]*>/gi, "");
  html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n<base href="${MAP_BASE}">`);
  html = html.replace(/<html\b([^>]*)>/i, (_match, attributes: string) => {
    let next = attributes;
    if (/\slang\s*=\s*(["'])[^"']*\1/i.test(next)) {
      next = next.replace(/\slang\s*=\s*(["'])[^"']*\1/i, ' lang="fr"');
    } else {
      next += ' lang="fr"';
    }

    const classMatch = next.match(/\sclass\s*=\s*(["'])([^"']*)\1/i);
    if (classMatch) {
      const classes = new Set(classMatch[2].split(/\s+/).filter(Boolean));
      classes.add("sgp-map");
      next = next.replace(classMatch[0], ` class="${[...classes].join(" ")}"`);
    } else {
      next += ' class="sgp-map"';
    }
    return `<html${next}>`;
  });

  html = replaceOrInsertTitle(html, "Carte — SGP");
  html = replaceMetaContent(html, "theme-color", "#18252f");
  html = replaceIcon(html, MAP_FAVICON);

  const headInjection = [
    source.includes(MAP_STYLESHEET) ? "" : `<link rel="stylesheet" href="${MAP_STYLESHEET}">`,
    `<style id="sgp-map-critical">${CRITICAL_STYLE}</style>`,
  ].filter(Boolean).join("\n");
  html = html.replace(/<\/head>/i, `${headInjection}\n</head>`);

  if (!html.includes('data-sgp-map-header="true"')) {
    html = html.replace(/<body\b([^>]*)>/i, (match) => `${match}\n${renderMapHeader()}\n${renderLoadingSurface()}`);
  }
  html = html.replace(/<\/body>/i, `<script id="sgp-map-shell-bootstrap">${MAP_SHELL_BOOTSTRAP}</script>\n</body>`);

  return html;
}

export function renderMapUnavailablePage(): string {
  return `<!doctype html>
<html lang="fr" class="sgp-map sgp-map-ready">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#18252f">
<link rel="icon" href="${MAP_FAVICON}">
<link rel="stylesheet" href="${MAP_STYLESHEET}">
<style id="sgp-map-critical">${CRITICAL_STYLE}</style>
<title>Carte indisponible — SGP</title>
</head>
<body>
${renderMapHeader()}
<main class="sgp-map-unavailable" id="main-content">
  <div>
    <p class="sgp-map-unavailable-eyebrow">Carte</p>
    <h1>La carte ne répond pas.</h1>
    <p>BlueMap est momentanément indisponible. Le reste du site reste accessible.</p>
    <a href="/map">Réessayer</a>
  </div>
</main>
</body>
</html>`;
}

export function renderMapHeader(): string {
  const desktopLinks = siteNavigation.map(({ href, label }) => renderNavigationLink(href, label, "sgp-map-nav-link")).join("");
  const mobileLinks = siteNavigation.map(({ href, label }) => renderNavigationLink(href, label, "sgp-map-mobile-nav-link")).join("");

  return `<header class="sgp-map-header" data-sgp-map-header="true">
  <div class="sgp-map-header-inner">
    <a class="sgp-map-brand" href="/" aria-label="SGP — Accueil">
      <span class="sgp-map-brand-mark" aria-hidden="true"><img src="${MAP_FAVICON}" alt="" width="34" height="34"></span>
      <span class="sgp-map-brand-copy"><strong>SGP</strong><small>Soirée du Grand Poulet</small></span>
    </a>
    <nav class="sgp-map-nav" aria-label="Navigation principale">${desktopLinks}</nav>
    ${renderProfileLink("sgp-map-profile")}
    <button class="sgp-map-menu-button" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="sgp-map-mobile-navigation">
      <svg class="sgp-map-menu-open-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <svg class="sgp-map-menu-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
  </div>
  <div class="sgp-map-mobile-menu" id="sgp-map-mobile-navigation">
    <nav class="sgp-map-mobile-nav" aria-label="Navigation mobile">${mobileLinks}${renderProfileLink("sgp-map-profile sgp-map-mobile-profile")}</nav>
  </div>
</header>`;
}

function renderLoadingSurface(): string {
  return `<div class="sgp-map-loading" aria-hidden="true">
  <div class="sgp-map-loading-mark"><span class="sgp-map-loading-label">Chargement de la carte</span><span class="sgp-map-loading-line"></span></div>
</div>`;
}

function renderNavigationLink(href: string, label: string, className: string): string {
  const active = href === "/map";
  return `<a class="${className}${active ? " is-active" : ""}" href="${escapeHtml(href)}"${active ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`;
}

function renderProfileLink(className: string): string {
  return `<a class="${className}" href="/me"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg><span>Mon profil</span></a>`;
}

function replaceOrInsertTitle(html: string, title: string): string {
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }
  return html.replace(/<\/head>/i, `<title>${escapeHtml(title)}</title>\n</head>`);
}

function replaceMetaContent(html: string, name: string, content: string): string {
  const meta = new RegExp(`<meta\\b(?=[^>]*\\bname\\s*=\\s*(["'])${escapeRegExp(name)}\\1)[^>]*>`, "i");
  const match = html.match(meta);
  if (!match) {
    return html.replace(/<\/head>/i, `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">\n</head>`);
  }
  const replacement = /\bcontent\s*=\s*(["'])[^"']*\1/i.test(match[0])
    ? match[0].replace(/\bcontent\s*=\s*(["'])[^"']*\1/i, `content="${escapeHtml(content)}"`)
    : match[0].replace(/>$/, ` content="${escapeHtml(content)}">`);
  return html.replace(match[0], replacement);
}

function replaceIcon(html: string, href: string): string {
  const icon = /<link\b(?=[^>]*\brel\s*=\s*(["'])icon\1)[^>]*>/i;
  const match = html.match(icon);
  if (!match) {
    return html.replace(/<\/head>/i, `<link rel="icon" href="${escapeHtml(href)}">\n</head>`);
  }
  const replacement = /\bhref\s*=\s*(["'])[^"']*\1/i.test(match[0])
    ? match[0].replace(/\bhref\s*=\s*(["'])[^"']*\1/i, `href="${escapeHtml(href)}"`)
    : match[0].replace(/>$/, ` href="${escapeHtml(href)}">`);
  return html.replace(match[0], replacement);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
