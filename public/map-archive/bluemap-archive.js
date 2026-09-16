(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src;
  const initialCameraHash = window.location.hash;
  const bluemap = window.bluemap;
  const embedded = window.parent !== window;
  let bridgeReady = false;
  let disposed = false;
  let liveManagersDisposed = false;
  let parentActive = !embedded;
  let cameraPoll = null;
  let lastHash = "";
  let pendingAction = null;
  let pendingHiresDistance = null;

  function postToParent(message) {
    if (!embedded || disposed) return;
    window.parent.postMessage(message, window.location.origin);
  }

  function sendCamera(force = false) {
    if (!embedded || !parentActive || disposed) return;
    const hash = window.location.hash;
    if (!force && hash === lastHash) return;
    lastHash = hash;
    postToParent({ type: "sgp-map-camera", hash });
  }

  function updateCameraPolling() {
    if (!embedded) return;
    if (!parentActive || disposed) {
      if (cameraPoll !== null) window.clearInterval(cameraPoll);
      cameraPoll = null;
      return;
    }
    if (cameraPoll === null) cameraPoll = window.setInterval(sendCamera, 250);
    sendCamera(true);
  }

  function normalizeCameraHash(value) {
    if (typeof value !== "string" || !value) return "";
    return value.startsWith("#") ? value : `#${value}`;
  }

  function applyHiresDistance(value) {
    const distance = Number(value);
    if (!Number.isFinite(distance) || distance < 0) return false;
    if (!bluemap?.settings || !bluemap.mapViewer?.data) return false;
    const changed = bluemap.settings.hiresSliderDefault !== distance
      || bluemap.mapViewer.data.loadedHiresViewDistance !== distance;
    bluemap.settings.hiresSliderDefault = distance;
    bluemap.mapViewer.data.loadedHiresViewDistance = distance;
    if (changed) bluemap.mapViewer.updateLoadedMapArea?.();
    return true;
  }

  async function applyCameraHash(hash) {
    const normalized = normalizeCameraHash(hash);
    if (!normalized || disposed) return false;

    // replaceState avoids creating a browser-history entry for every timeline
    // switch. BlueMap's own hashchange handler therefore will not run, so call
    // its address loader explicitly after updating the URL.
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${normalized}`,
    );
    if (typeof bluemap?.loadPageAddress === "function") {
      await bluemap.loadPageAddress();
    }
    sendCamera(true);
    return true;
  }

  async function applyAction(action) {
    if (!action || disposed) return;
    if (action.type === "camera") {
      await applyCameraHash(action.hash);
      return;
    }
    if (action.type === "reset" && typeof bluemap?.resetCamera === "function") {
      bluemap.resetCamera();
      bluemap.updatePageAddress?.();
      sendCamera(true);
      postToParent({ type: "sgp-map-reset-complete", hash: window.location.hash });
    }
  }

  function disposeLiveManagers() {
    if (!bluemap || liveManagersDisposed) return;
    liveManagersDisposed = true;
    try { bluemap.mapEventSource?.close?.(); } catch {}
    try { bluemap.playerMarkerManager?.dispose?.(); } catch {}
    try { bluemap.markerFileManager?.dispose?.(); } catch {}
    if (bluemap.updateLoop) window.clearTimeout(bluemap.updateLoop);
    // Keep the disposed manager objects in place: an already-queued SSE error
    // callback may still reference them, and their disposed flag makes that safe.
    bluemap.updateLoop = null;
    bluemap.initEventSource = () => undefined;
    bluemap.initPlayerMarkerManager = () => undefined;
    bluemap.initMarkerFileManager = () => undefined;
    bluemap.update = () => undefined;
  }

  function disposeRendererCandidate(renderer) {
    if (!renderer || typeof renderer !== "object") return false;
    let handled = false;
    try {
      if (typeof renderer.setAnimationLoop === "function") {
        renderer.setAnimationLoop(null);
        handled = true;
      }
      if (typeof renderer.dispose === "function") {
        renderer.dispose();
        handled = true;
      }
      if (typeof renderer.forceContextLoss === "function") {
        renderer.forceContextLoss();
        handled = true;
      }
    } catch {
      // The raw-canvas context-loss fallback below still runs.
    }
    return handled;
  }

  function loseDocumentWebGlContexts() {
    if (typeof document.querySelectorAll !== "function") return;
    for (const canvas of document.querySelectorAll("canvas")) {
      try {
        const context = canvas.getContext?.("webgl2") ?? canvas.getContext?.("webgl");
        context?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
      } catch {
        // Best-effort: unloading the iframe releases the remaining JS graph.
      }
    }
  }

  function disposeArchiveViewer() {
    if (disposed) return true;
    disposed = true;
    parentActive = false;
    pendingAction = null;
    pendingHiresDistance = null;
    updateCameraPolling();
    disposeLiveManagers();

    // BlueMap versions do not expose a stable public renderer teardown API, so
    // use known renderer-shaped fields when present and always follow with the
    // standard WEBGL_lose_context extension on the document canvases.
    const mapViewer = bluemap?.mapViewer;
    const candidates = [
      mapViewer?.renderer,
      mapViewer?._renderer,
      bluemap?.renderer,
    ];
    for (const renderer of candidates) disposeRendererCandidate(renderer);
    loseDocumentWebGlContexts();
    return true;
  }

  // Same-origin timeline parents call this synchronously before removing an
  // iframe, which releases GPU resources without waiting for browser GC.
  window.sgpArchiveDispose = disposeArchiveViewer;

  function onMessage(event) {
    if (disposed || !embedded || event.origin !== window.location.origin || event.source !== window.parent) return;

    if (event.data?.type === "sgp-map-active" && typeof event.data.active === "boolean") {
      parentActive = event.data.active;
      updateCameraPolling();
      return;
    }

    if (event.data?.type === "sgp-map-hires") {
      const distance = Number(event.data.distance);
      if (!Number.isFinite(distance) || distance < 0) return;
      if (!applyHiresDistance(distance)) pendingHiresDistance = distance;
      return;
    }

    if (event.data?.type === "sgp-map-dispose") {
      disposeArchiveViewer();
      return;
    }

    if (event.data?.type === "sgp-map-set-camera") {
      const hash = normalizeCameraHash(event.data.hash);
      if (!hash) return;
      const action = { type: "camera", hash };
      if (!bridgeReady) pendingAction = action;
      else void applyAction(action).catch((error) => console.warn(`[SGP archive camera] ${error instanceof Error ? error.message : error}`));
      return;
    }

    if (event.data?.type === "sgp-map-reset") {
      const action = { type: "reset" };
      if (!bridgeReady) pendingAction = action;
      else void applyAction(action).catch((error) => console.warn(`[SGP archive reset] ${error instanceof Error ? error.message : error}`));
    }
  }

  window.addEventListener("message", onMessage);
  window.addEventListener("beforeunload", disposeArchiveViewer);

  // This archive is deliberately not a live BlueMap. The app creates these
  // managers before custom scripts load, so dispose them immediately and make
  // any later map switch stay static too.
  disposeLiveManagers();

  async function installArenaControls() {
    if (!scriptUrl) throw new Error("archive script URL is unavailable");
    const base = new URL(".", scriptUrl);
    const [module, response] = await Promise.all([
      import(new URL("sgp-controls.mjs", base).href),
      fetch(new URL("sgp-archive.json", base), { cache: "force-cache" }),
    ]);
    if (!response.ok) throw new Error(`archive metadata request failed: ${response.status}`);
    const archive = await response.json();
    const center = archive?.center;
    if (![center?.x, center?.y, center?.z].every(Number.isFinite)) throw new Error("archive center is invalid");
    const defaultTarget = module.cameraTarget(archive?.startLocation) ?? center;
    const requestedTarget = module.cameraTarget(initialCameraHash);
    module.installSgpBlueMapControls({
      resetCenter: defaultTarget,
      initialTargetY: requestedTarget?.y ?? defaultTarget.y,
    });
    return archive;
  }

  async function finishBridgeSetup() {
    let archive = null;
    try {
      archive = await installArenaControls();
    } catch (error) {
      console.warn(`[SGP archive controls] ${error instanceof Error ? error.message : error}`);
    }
    if (disposed) return;

    bridgeReady = true;

    // Archive webapp.conf starts at the lightweight preload radius. A directly
    // opened archive has no parent to promote it, so restore full quality here.
    if (!embedded) {
      const activeDistance = Number(archive?.viewerHires?.active ?? 250);
      if (Number.isFinite(activeDistance) && activeDistance >= 0) applyHiresDistance(activeDistance);
    }
    if (pendingHiresDistance !== null) {
      applyHiresDistance(pendingHiresDistance);
      pendingHiresDistance = null;
    }

    if (pendingAction) {
      const action = pendingAction;
      pendingAction = null;
      try {
        await applyAction(action);
      } catch (error) {
        console.warn(`[SGP archive bridge] ${error instanceof Error ? error.message : error}`);
      }
    }
    if (disposed) return;

    updateCameraPolling();
    postToParent({ type: "sgp-map-ready", hash: window.location.hash });
    sendCamera(true);
  }

  window.addEventListener("hashchange", () => sendCamera());
  window.addEventListener("load", () => sendCamera(true));
  void finishBridgeSetup();
})();
