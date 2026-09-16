(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src;
  const initialCameraHash = window.location.hash;

  // This archive is deliberately not a live BlueMap. The app creates these
  // managers before custom scripts load, so dispose them immediately and make
  // any later map switch stay static too.
  const bluemap = window.bluemap;
  if (bluemap) {
    if (bluemap.mapEventSource) bluemap.mapEventSource.close();
    if (bluemap.playerMarkerManager) bluemap.playerMarkerManager.dispose();
    if (bluemap.markerFileManager) bluemap.markerFileManager.dispose();
    if (bluemap.updateLoop) window.clearTimeout(bluemap.updateLoop);
    // Keep the disposed manager objects in place: an already-queued SSE error
    // callback may still reference them, and their disposed flag makes that safe.
    bluemap.updateLoop = null;
    bluemap.initEventSource = () => undefined;
    bluemap.initPlayerMarkerManager = () => undefined;
    bluemap.initMarkerFileManager = () => undefined;
    bluemap.update = () => undefined;
  }

  async function installArenaControls() {
    if (!scriptUrl) throw new Error("archive script URL is unavailable");
    const base = new URL(".", scriptUrl);
    const [module, response] = await Promise.all([
      import(new URL("sgp-controls.mjs", base).href),
      fetch(new URL("sgp-archive.json", base), { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`archive metadata request failed: ${response.status}`);
    const archive = await response.json();
    const center = archive?.center;
    if (![center?.x, center?.y, center?.z].every(Number.isFinite)) throw new Error("archive center is invalid");
    const requestedTargetY = module.cameraTargetY(initialCameraHash);
    module.installSgpBlueMapControls({
      resetCenter: center,
      initialTargetY: requestedTargetY ?? center.y,
    });
  }
  installArenaControls().catch((error) => console.warn(`[SGP archive controls] ${error instanceof Error ? error.message : error}`));

  let lastHash = "";
  function sendCamera() {
    if (window.parent === window || window.location.hash === lastHash) return;
    lastHash = window.location.hash;
    window.parent.postMessage({ type: "sgp-map-camera", hash: lastHash }, window.location.origin);
  }

  window.addEventListener("hashchange", sendCamera);
  // BlueMap writes camera anchors with history.replaceState(), which does not emit
  // hashchange. Polling the local URL keeps this bridge independent of internals.
  window.setInterval(sendCamera, 250);
  window.addEventListener("load", sendCamera);
  sendCamera();
})();
