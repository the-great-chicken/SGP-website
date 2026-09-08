import assert from "node:assert/strict";
import test from "node:test";
import { injectBlueMapShell, renderMapHeader, renderMapUnavailablePage } from "../src/lib/bluemap-shell";
import { blueMapDevelopmentRewrites, blueMapDevRewriteDestination, resolveBlueMapOrigin } from "../src/lib/bluemap-routing";
import { siteNavigation } from "../src/lib/site-navigation";

// Matches the generated structure shipped by BlueMap 5.23. The hashed asset
// names are deliberately arbitrary: the shell must not depend on a build hash.
const bluemapIndex = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
<meta name="theme-color" content="#006EDE">
<link rel="icon" href="./assets/favicon-DEN7TZ5X.png">
<title>BlueMap</title>
<script type="module" crossorigin src="./assets/index-DmPliJXu.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-BgiqB2rB.css">
</head>
<body>
<noscript><strong>BlueMap needs JavaScript.</strong></noscript>
<div id="map-container"></div>
<div id="app"></div>
</body>
</html>`;

test("BlueMap shell preserves the native app and makes the SGP shell first-paint HTML", () => {
  const html = injectBlueMapShell(bluemapIndex);

  assert.match(html, /<html[^>]*lang="fr"[^>]*class="sgp-map"|<html[^>]*class="sgp-map"[^>]*lang="fr"/i);
  assert.match(html, /<title>Carte — SGP<\/title>/);
  assert.match(html, /name="theme-color" content="#18252f"/);
  assert.match(html, /rel="icon" href="\/bluemap\/sgp\.svg"/);
  assert.match(html, /href="\/bluemap\/sgp\.css"/);
  assert.match(html, /id="sgp-map-critical"/);
  assert.match(html, /data-sgp-map-header="true"/);
  assert.match(html, /class="sgp-map-loading"/);
  assert.match(html, /id="sgp-map-shell-bootstrap"/);

  // /map is intentionally extensionless. A base tag before BlueMap's first
  // relative URL keeps all of its native ./assets, settings.json and maps/*
  // requests under /map/ without rewriting the generated bundle.
  assert.match(html, /<base href="\/map\/">/);
  assert.ok(html.indexOf('<base href="/map/">') < html.indexOf('./assets/index-DmPliJXu.js'));

  // Readiness follows BlueMap's own MapViewer state, not early DOM/canvas
  // construction (the renderer canvas exists before bluemap.load() completes).
  assert.match(html, /mapState/);
  assert.match(html, /state === "loaded"/);
  assert.match(html, /state === "errored"/);
  assert.doesNotMatch(html, /querySelector\(["']canvas["']\)/);
  assert.doesNotMatch(html, /3000/);

  assert.match(html, /<div id="map-container"><\/div>/);
  assert.match(html, /<div id="app"><\/div>/);
  assert.match(html, /<script type="module" crossorigin src="\.\/assets\/index-DmPliJXu\.js"><\/script>/);
  assert.ok(html.indexOf("data-sgp-map-header") < html.indexOf('id="map-container"'));
});

test("the shell replaces an upstream base tag so BlueMap always resolves beneath /map/", () => {
  const source = bluemapIndex.replace("<head>", '<head>\n<base href="/old-map-root/">');
  const html = injectBlueMapShell(source);
  assert.equal(html.match(/<base\b/g)?.length, 1);
  assert.match(html, /<head>\s*<base href="\/map\/">/);
  assert.doesNotMatch(html, /old-map-root/);
});

test("the shell does not add a second SGP stylesheet when BlueMap already registered it", () => {
  const source = bluemapIndex.replace("</head>", '<link rel="stylesheet" href="/bluemap/sgp.css">\n</head>');
  const html = injectBlueMapShell(source);
  assert.equal(html.match(/\/bluemap\/sgp\.css/g)?.length, 1);
});

test("map header navigation comes from the same navigation manifest as the Next header", () => {
  const header = renderMapHeader();
  for (const { href, label } of siteNavigation) {
    assert.match(header, new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>${label}<`));
  }
  assert.match(header, /href="\/map" aria-current="page">Carte<\/a>/);
  assert.match(header, /aria-controls="sgp-map-mobile-navigation"/);
});

test("BlueMap failure still returns a navigable Slate page instead of a blank document", () => {
  const html = renderMapUnavailablePage();
  assert.match(html, /class="sgp-map sgp-map-ready"/);
  assert.match(html, /La carte ne répond pas\./);
  assert.match(html, /data-sgp-map-header="true"/);
  assert.match(html, /href="\/map">Réessayer<\/a>/);
});

test("unexpected upstream documents are rejected instead of being partially rewritten", () => {
  assert.throws(() => injectBlueMapShell("not html"), /unexpected HTML document/);
});

test("BlueMap origin normalization is shared by the shell and local development proxy", () => {
  assert.equal(resolveBlueMapOrigin("http://127.0.0.1:8123/ignored/path?x=1#hash").href, "http://127.0.0.1:8123/");
  assert.equal(blueMapDevRewriteDestination("http://localhost:8123/"), "http://localhost:8123/:path*");
  assert.deepEqual(blueMapDevelopmentRewrites("http://localhost:8123/"), {
    fallback: [
      {
        source: "/map/:path*",
        destination: "http://localhost:8123/:path*",
      },
    ],
  });
  assert.throws(() => resolveBlueMapOrigin("file:///tmp/map"), /http or https/);
  assert.throws(() => resolveBlueMapOrigin("http://user:pass@localhost:8100"), /must not contain credentials/);
});
