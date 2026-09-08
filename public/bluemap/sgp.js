// Loaded by BlueMap 5.23 through webapp.conf, after its app has initialized.
(() => {
  const themeUrl = new URL(".", document.currentScript.src);
  document.documentElement.classList.add("sgp-map");
  document.title = "Carte — SGP";
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = "#18252f";
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = new URL("sgp.svg", themeUrl).href;

  const bluemap = window.bluemap;
  // BlueMap 5.23 installs its live translation function on the mounted Vue app.
  const appRoot = document.getElementById("app");
  const translations = appRoot.__vue_app__.config.globalProperties;
  bluemap.settings.hiresSliderDefault = 250;
  bluemap.mapViewer.data.loadedHiresViewDistance = 250;
  bluemap.mapViewer.updateLoadedMapArea();
  bluemap.setChunkBorders(false);
  bluemap.setDebug(false);
  bluemap.saveUserSettings();

  function disableFlatView() {
    const map = bluemap.mapViewer.map;
    if (!map) return;
    map.data.flatView = false;
    const index = map.data.views.indexOf("flat");
    if (index !== -1) map.data.views.splice(index, 1);
    if (bluemap.appState.controls.state === "flat") bluemap.setPerspectiveView(0);
  }

  function simplifyMenu() {
    const page = bluemap.mainMenu.currentPage().id;
    const buttonKeys = page === "root" ? ["maps.button", "updateMap.button"]
      : page === "settings" ? ["chunkBorders.button", "debug.button"] : [];
    const groupKeys = page === "settings" ? ["renderDistance.title", "mapControls.title", "theme.title"] : [];
    const buttons = new Set(buttonKeys.map((key) => translations.$t(key)));
    const groups = new Set(groupKeys.map((key) => translations.$t(key)));
    for (const button of document.querySelectorAll(".side-menu .simple-button, .side-menu .switch-button")) {
      button.classList.toggle("sgp-menu-hidden", buttons.has(button.querySelector(".label").textContent.trim()));
    }
    for (const group of document.querySelectorAll(".side-menu .group")) {
      group.classList.toggle("sgp-menu-hidden", groups.has(group.querySelector(":scope > .title").textContent.trim()));
    }
  }
  const menuObserver = new MutationObserver(() => { disableFlatView(); simplifyMenu(); });
  menuObserver.observe(appRoot, { childList: true, subtree: true, characterData: true });
  disableFlatView();
  simplifyMenu();

  function createHeaderFallback() {
    const header = document.createElement("header");
    header.className = "sgp-map-header";
    header.dataset.sgpMapHeader = "true";
    header.innerHTML = `
      <div class="sgp-map-header-inner">
        <a class="sgp-map-brand" href="/" aria-label="SGP — Accueil">
          <span class="sgp-map-brand-mark" aria-hidden="true"><img src="${new URL("sgp.svg", themeUrl).href}" alt="" width="34" height="34"></span>
          <span class="sgp-map-brand-copy"><strong>SGP</strong><small>Soirée du Grand Poulet</small></span>
        </a>
        <nav class="sgp-map-nav" aria-label="Navigation principale">
          <a class="sgp-map-nav-link" href="/">Accueil</a>
          <a class="sgp-map-nav-link" href="/kits">Kits</a>
          <a class="sgp-map-nav-link" href="/leaderboards">Classements</a>
          <a class="sgp-map-nav-link" href="/players">Joueurs</a>
          <a class="sgp-map-nav-link" href="/wiki">Histoire</a>
          <a class="sgp-map-nav-link is-active" href="/map" aria-current="page">Carte</a>
        </nav>
        <a class="sgp-map-profile" href="/me"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg><span>Mon profil</span></a>
        <button class="sgp-map-menu-button" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="sgp-map-mobile-navigation">
          <svg class="sgp-map-menu-open-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          <svg class="sgp-map-menu-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sgp-map-mobile-menu" id="sgp-map-mobile-navigation">
        <nav class="sgp-map-mobile-nav" aria-label="Navigation mobile">
          <a class="sgp-map-mobile-nav-link" href="/">Accueil</a>
          <a class="sgp-map-mobile-nav-link" href="/kits">Kits</a>
          <a class="sgp-map-mobile-nav-link" href="/leaderboards">Classements</a>
          <a class="sgp-map-mobile-nav-link" href="/players">Joueurs</a>
          <a class="sgp-map-mobile-nav-link" href="/wiki">Histoire</a>
          <a class="sgp-map-mobile-nav-link is-active" href="/map" aria-current="page">Carte</a>
          <a class="sgp-map-profile sgp-map-mobile-profile" href="/me"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg><span>Mon profil</span></a>
        </nav>
      </div>`;
    document.body.prepend(header);
    return header;
  }

  const header = document.querySelector("[data-sgp-map-header='true']") || createHeaderFallback();
  const menuButton = header.querySelector(".sgp-map-menu-button");
  const mobileMenu = header.querySelector(".sgp-map-mobile-menu");
  function setMenuOpen(open) {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    mobileMenu.classList.toggle("is-open", open);
  }
  menuButton?.addEventListener("click", () => setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true"));
  mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuOpen(false)));

  const mapContainer = document.getElementById("map-container");
  const playerMarkerPattern = /^bm-marker-bm-player-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
  const linkedMarkers = new WeakSet();

  function linkPlayerMarker(marker) {
    const match = playerMarkerPattern.exec(marker.id);
    if (!match || linkedMarkers.has(marker)) return;

    const link = document.createElement("a");
    link.className = "sgp-player-profile";
    link.href = `/players/${match[1].toLowerCase()}`;
    link.title = "Voir le profil SGP";
    link.draggable = false;
    marker.querySelector("img").alt = "";
    // Keep BlueMap's name/head nodes intact so live updates still reach them.
    link.append(...marker.childNodes);
    marker.append(link);
    linkedMarkers.add(marker);

    // Keep native link navigation and keyboard/modifier support, without activating map controls.
    for (const type of ["pointerdown", "mousedown", "touchstart", "click", "contextmenu"]) {
      link.addEventListener(type, (event) => event.stopPropagation());
    }
  }

  function linkPlayerMarkers(root) {
    if (root.matches(".bm-marker-player")) linkPlayerMarker(root);
    root.querySelectorAll(".bm-marker-player").forEach(linkPlayerMarker);
  }

  linkPlayerMarkers(mapContainer);
  const playerObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) linkPlayerMarkers(node);
      }
    }
  });
  playerObserver.observe(mapContainer, { childList: true, subtree: true });

  async function loadOverlays() {
    const response = await fetch(new URL("overlays.json", themeUrl), { cache: "no-cache" });
    if (response.status === 404) return; // No map export has been published yet.
    if (!response.ok) throw new Error(`Map overlay request failed: ${response.status}`);
    const overlays = await response.json();
    if (overlays.schemaVersion !== 1) throw new Error("Unsupported SGP map overlay format");

    // BlueMap 5.23 replaces normal marker sets on refresh. Merge our sets into that update
    // so they survive its regular refreshes and follow the selected map.
    const prototype = window.BlueMap.NormalMarkerManager.prototype;
    const updateFromData = prototype.updateFromData;
    prototype.updateFromData = function (markers) {
      if (this.disposed) return false;
      const mapId = window.bluemap.mapViewer.map.data.id;
      const result = updateFromData.call(this, { ...markers, ...overlays.maps[mapId] });
      window.bluemap.mapViewer.redraw();
      return result;
    };
    await window.bluemap.markerFileManager.update();
  }
  loadOverlays().catch((error) => console.error("SGP map overlays:", error));

  // BlueMap listens to window resize; also notify it when our CSS changes its viewport.
  const resizeObserver = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
  resizeObserver.observe(mapContainer);

})();
