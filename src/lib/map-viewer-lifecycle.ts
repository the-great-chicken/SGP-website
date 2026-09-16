type ArchiveFrameWindow = Window & {
  sgpArchiveDispose?: () => boolean | void;
};

function loseDocumentWebGlContexts(document: Document | null | undefined) {
  if (!document) return;
  for (const canvas of document.querySelectorAll("canvas")) {
    try {
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      // The iframe is about to be destroyed anyway; context loss is best-effort.
    }
  }
}

/**
 * Explicitly release an archived BlueMap iframe before it leaves the cache.
 * New archive revisions expose a synchronous teardown hook. The canvas fallback
 * covers immutable revisions created before that hook existed.
 */
export function disposeMapViewerFrame(frame: HTMLIFrameElement) {
  let disposedByBridge = false;
  try {
    const frameWindow = frame.contentWindow as ArchiveFrameWindow | null;
    disposedByBridge = frameWindow?.sgpArchiveDispose?.() === true;
  } catch {
    // Same-origin direct access can fail under stricter browser isolation.
  }

  if (!disposedByBridge) {
    try {
      loseDocumentWebGlContexts(frame.contentDocument);
    } catch {
      // Navigating the frame below still releases its JS document graph.
    }
  }

  try {
    // Detach the old browsing context immediately instead of leaving BlueMap's
    // scene graph waiting for non-deterministic iframe/GC cleanup.
    frame.src = "about:blank";
  } catch {
    // React will remove the iframe even if the explicit navigation is blocked.
  }
}
