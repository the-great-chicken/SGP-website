(() => {
  "use strict";

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
