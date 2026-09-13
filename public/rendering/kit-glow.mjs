import { readCssColor, readSolidBackdrop } from "./backdrop.mjs";
import { rasterizeRadialGradients } from "./radial-gradients.mjs";

// The original model-surface and player-stage gradients, bottom-to-top.
const KIT_GLOW_LAYERS = [
  { x: 0.5, y: 0.7, stop: 0.65, opacity: 0.09 },
  { x: 0.5, y: 0.5, stop: 0.68, opacity: 0.09 },
];

class KitGlowElement extends HTMLElement {
  static observedAttributes = ["color"];
  #canvas;
  #observer;
  #resolution;
  #frame = 0;
  #rasterKey = "";

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    this.#canvas = document.createElement("canvas");
    this.#canvas.style.display = "block";
    this.#canvas.setAttribute("aria-hidden", "true");
    shadow.append(this.#canvas);
    this.#observer = new ResizeObserver(this.#schedule);
  }

  connectedCallback() {
    this.#observer.observe(this);
    this.#watchResolution();
    this.#schedule();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    this.#resolution.removeEventListener("change", this.#onResolutionChange);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#schedule();
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
    const { width, height } = this.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const pixelRatio = window.devicePixelRatio;
    const color = readCssColor(this.getAttribute("color"));
    const background = readSolidBackdrop(this);
    const rasterKey = [width, height, pixelRatio, ...color, ...background].join(":");
    if (rasterKey === this.#rasterKey) return;

    const pixelWidth = Math.ceil(width * pixelRatio);
    const pixelHeight = Math.ceil(height * pixelRatio);
    const pixels = rasterizeRadialGradients({
      width, height, pixelWidth, pixelHeight, pixelRatio, background,
      layers: KIT_GLOW_LAYERS.map((layer) => ({ ...layer, color })),
    });
    this.#canvas.width = pixelWidth;
    this.#canvas.height = pixelHeight;
    this.#canvas.style.width = `${pixelWidth / pixelRatio}px`;
    this.#canvas.style.height = `${pixelHeight / pixelRatio}px`;
    this.#canvas.getContext("2d").putImageData(new ImageData(pixels, pixelWidth, pixelHeight), 0, 0);
    this.#rasterKey = rasterKey;
  };
}

customElements.define("sgp-kit-glow", KitGlowElement);
