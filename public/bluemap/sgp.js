// Loaded by BlueMap 5.23 through webapp.conf, after its app has initialized.
(() => {
  const themeUrl = new URL(".", document.currentScript.src);
  document.documentElement.classList.add("sgp-map");
  document.title = "Carte — SGP";
  document.querySelector('meta[name="theme-color"]').content = "#101416";
  document.querySelector('link[rel="icon"]').href = new URL("sgp.svg", themeUrl).href;

  const header = document.createElement("header");
  header.className = "sgp-map-header";
  header.lang = "fr";

  const brand = document.createElement("a");
  brand.className = "sgp-map-brand";
  brand.href = "/";
  brand.setAttribute("aria-label", "SGP — Accueil");
  const logo = document.createElement("img");
  logo.src = new URL("sgp.svg", themeUrl).href;
  logo.alt = "";
  logo.width = 40;
  logo.height = 40;
  const wordmark = document.createElement("strong");
  wordmark.textContent = "SGP";
  brand.append(logo, wordmark);

  const title = document.createElement("span");
  title.className = "sgp-map-title";
  title.textContent = "Le terrain de jeu";

  const navigation = document.createElement("nav");
  navigation.setAttribute("aria-label", "Navigation SGP");
  const back = document.createElement("a");
  back.className = "sgp-map-back";
  back.href = "/";
  const arrow = document.createElement("span");
  arrow.textContent = "←";
  arrow.setAttribute("aria-hidden", "true");
  back.append(arrow, "Retour au site");
  navigation.append(back);

  header.append(brand, title, navigation);
  document.body.prepend(header);

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

  // BlueMap listens to window resize; also notify it when our CSS changes its viewport.
  const resizeObserver = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
  resizeObserver.observe(mapContainer);
})();
