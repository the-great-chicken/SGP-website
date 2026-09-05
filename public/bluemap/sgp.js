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

  // BlueMap listens to window resize; also notify it when our CSS changes its viewport.
  const resizeObserver = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
  resizeObserver.observe(document.getElementById("map-container"));
})();
