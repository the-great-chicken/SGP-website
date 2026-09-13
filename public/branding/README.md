Use `<SiteLogo />` in React. Plain HTML uses `<sgp-logo><img …></sgp-logo>` with `site-logo.css` and the `site-logo.mjs` module. The parent sets the size; the image retains its normal alt text.

`logo-glow.mjs` owns the logo's shadow colors, strength and blur; `site-logo.css` owns its corner radius. The custom element owns a page-level canvas, tracks the logo's position/layer, and removes the canvas and listeners on disconnect. Scrolling only repositions cached pixels; size, zoom or surface changes redraw them.

`../rendering/dither.mjs` writes final RGB at device resolution. The logo supplies its light contribution and uses `plus-lighter` over the finished page, where black leaves the backdrop unchanged. Do not move the canvas inside the translucent header or apply opacity, blur or scaling afterward.

Other light glows can use this same path. Gradients that darken their surface must instead composite their full background before dithering. `readSolidBackdrop` resolves CSS background colors, not background images or filtered content.
