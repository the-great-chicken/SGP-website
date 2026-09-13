`dither.mjs` quantizes final sRGB pixels. The logo uses it for additive light; `radial-gradients.mjs` uses it after compositing gradients onto a solid background, preserving channels that darken as well as brighten.

`kit-glow.mjs` owns the kit gradient layout. `<sgp-kit-glow color="…">` redraws on size, display-density or color changes and cleans up on disconnect. It stays behind the model and its floor shadow. Do not fade, blur or scale its finished pixels.
