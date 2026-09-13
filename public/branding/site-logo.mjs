import { GLOW_PADDING, rasterizeLogoGlow } from "./logo-glow.mjs";
import { readSolidBackdrop } from "../rendering/backdrop.mjs";

// The glow is a page-level overlay: plus-lighter must see the finished backdrop,
// not the header's isolated, translucent compositing group. The custom element
// owns only that overlay; React continues to own the logo image.
class SiteLogoElement extends HTMLElement {
  #canvas;
  #observer;
  #resolution;
  #frame = 0;
  #rasterKey = "";

  constructor() {
    super();
    this.#canvas = document.createElement("canvas");
    this.#canvas.className = "site-logo-glow";
    this.#canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.#canvas.style, {
      position: "fixed", display: "block", pointerEvents: "none",
      mixBlendMode: "plus-lighter",
    });
    this.#observer = new ResizeObserver(this.#schedule);
  }

  connectedCallback() {
    document.body.append(this.#canvas);
    this.#observer.observe(this);
    this.#watchResolution();
    window.addEventListener("resize", this.#schedule);
    window.addEventListener("scroll", this.#schedule, { capture: true, passive: true });
    this.#schedule();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#resolution.removeEventListener("change", this.#onResolutionChange);
    window.removeEventListener("resize", this.#schedule);
    window.removeEventListener("scroll", this.#schedule, true);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#canvas.remove();
  }

  #watchResolution() {
    this.#resolution = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.#resolution.addEventListener("change", this.#onResolutionChange, { once: true });
  }

  #onResolutionChange = () => {
    this.#watchResolution();
    this.#schedule();
  };

  #schedule = () => {
    if (!this.#frame) this.#frame = requestAnimationFrame(this.#paint);
  };

  #paint = () => {
    this.#frame = 0;
    const rect = this.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom + GLOW_PADDING > 0 && rect.top - GLOW_PADDING < window.innerHeight;
    this.#canvas.style.display = visible ? "block" : "none";
    if (!visible) return;

    const pixelRatio = window.devicePixelRatio;
    const padding = Math.ceil(GLOW_PADDING * pixelRatio);
    const pixelWidth = Math.ceil(rect.width * pixelRatio) + 2 * padding;
    const pixelHeight = Math.ceil(rect.height * pixelRatio) + 2 * padding;
    // Snap movement to physical pixels without resampling the dither. Scrolling
    // moves the cached canvas; only size, zoom or surface changes rerasterize it.
    Object.assign(this.#canvas.style, {
      left: `${(Math.round(rect.left * pixelRatio) - padding) / pixelRatio}px`,
      top: `${(Math.round(rect.top * pixelRatio) - padding) / pixelRatio}px`,
      zIndex: String(pageLayer(this)),
      visibility: getComputedStyle(this).visibility,
    });
    const radiusValue = getComputedStyle(this).borderTopLeftRadius;
    const radius = parseFloat(radiusValue) * (radiusValue.endsWith("%") ? rect.width / 100 : 1);
    const backdrop = readSolidBackdrop(this);
    const rasterKey = [rect.width, rect.height, radius, pixelRatio, ...backdrop].join(":");
    if (rasterKey === this.#rasterKey) return;
    const pixels = rasterizeLogoGlow({
      width: rect.width, height: rect.height, radius, pixelRatio,
      pixelWidth, pixelHeight, offsetX: padding / pixelRatio, offsetY: padding / pixelRatio,
      backdrop,
    });

    this.#canvas.width = pixelWidth;
    this.#canvas.height = pixelHeight;
    Object.assign(this.#canvas.style, {
      width: `${pixelWidth / pixelRatio}px`, height: `${pixelHeight / pixelRatio}px`,
    });
    this.#canvas.getContext("2d").putImageData(new ImageData(pixels, pixelWidth, pixelHeight), 0, 0);
    this.#rasterKey = rasterKey;
  };
}

// Use the outermost numbered layer (e.g. the site/map header), so unrelated
// higher overlays still cover the glow. Appending to body paints it above its
// anchor's layer without an arbitrary always-on-top z-index.
function pageLayer(element) {
  let layer = 0;
  for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
    const zIndex = getComputedStyle(ancestor).zIndex;
    if (zIndex !== "auto") layer = Number(zIndex);
  }
  return layer;
}

customElements.define("sgp-logo", SiteLogoElement);
