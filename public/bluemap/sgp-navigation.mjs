function setMenuOpen(header, open) {
  const button = header.querySelector(".sgp-map-menu-button");
  const menu = header.querySelector(".sgp-map-mobile-menu");
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  menu.classList.toggle("is-open", open);
  menu.inert = !open;
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const header = event.target.closest(".sgp-map-header");
  if (!header) return;
  const button = event.target.closest(".sgp-map-menu-button");
  if (button) setMenuOpen(header, button.getAttribute("aria-expanded") !== "true");
  else if (event.target.closest("a")) setMenuOpen(header, false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const button = document.querySelector('.sgp-map-menu-button[aria-expanded="true"]');
  if (!button) return;
  setMenuOpen(button.closest(".sgp-map-header"), false);
  button.focus();
});
