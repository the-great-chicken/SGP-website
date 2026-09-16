"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapArchiveManifestEntry } from "@/map-archive/archive";
import {
  MAP_TIMELINE_VIEWER_CACHE_SIZE,
  mapTimelineAdjacentNumbers,
  mapTimelineEvictionCandidate,
  translateBlueMapHash,
} from "@/lib/map-timeline";
import { disposeMapViewerFrame } from "@/lib/map-viewer-lifecycle";
import {
  applySgpHiresViewDistance,
  SGP_HIRES_VIEW_DISTANCE,
  SGP_PRELOAD_HIRES_VIEW_DISTANCE,
  type BlueMapHiresRuntime,
} from "@/lib/map-viewer-settings";

type TimelineEdition = {
  number: number;
  dateLabel: string;
  shortTitle: string;
  minecraftVersion: string;
  snapshotKey: string;
  map: MapArchiveManifestEntry | null;
};

type AvailableEdition = TimelineEdition & { map: MapArchiveManifestEntry };
type Props = { editions: TimelineEdition[] };

type ViewerState = {
  editionNumber: number;
  revision: string;
  src: string;
  ready: boolean;
};

type BlueMapFrameWindow = Window & {
  bluemap?: BlueMapHiresRuntime & {
    loadPageAddress?: () => Promise<boolean> | boolean;
    resetCamera?: () => void;
    updatePageAddress?: () => void;
  };
};

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type PreloadMode = "idle" | "select";

type ViewerProps = {
  viewer: ViewerState;
  active: boolean;
  onFrame: (editionNumber: number, frame: HTMLIFrameElement | null) => void;
  onLoad: (editionNumber: number) => void;
};

function viewerUrl(entry: MapArchiveManifestEntry, hash = "") {
  return `/map-archive/${entry.webPath}/index.html${hash}`;
}

function canIdlePreload() {
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return false;
  return document.visibilityState === "visible";
}

function TimelineViewer({ viewer, active, onFrame, onLoad }: ViewerProps) {
  const editionNumber = viewer.editionNumber;

  // Do not perform destructive cleanup in the ref callback: React Strict Mode
  // intentionally replays ref setup/cleanup in development. Cache eviction is
  // the authoritative place where an iframe is torn down.
  const setFrameRef = useCallback((node: HTMLIFrameElement | null) => {
    onFrame(editionNumber, node);
  }, [editionNumber, onFrame]);

  return (
    <iframe
      ref={setFrameRef}
      className={`map-timeline-frame${active ? " is-active" : ""}`}
      src={viewer.src}
      title={`Carte 3D — édition ${viewer.editionNumber}`}
      allow="fullscreen"
      aria-hidden={!active}
      tabIndex={active ? 0 : -1}
      loading="eager"
      onLoad={() => onLoad(viewer.editionNumber)}
    />
  );
}

export function MapTimeline({ editions }: Props) {
  const available = useMemo(
    () => editions.filter((edition): edition is AvailableEdition => edition.map !== null),
    [editions],
  );
  const editionByNumber = useMemo(
    () => new Map(available.map((edition) => [edition.number, edition])),
    [available],
  );
  const availableNumbers = useMemo(() => available.map((edition) => edition.number), [available]);
  const initialEdition = available.at(-1);
  const initialNumber = initialEdition?.number ?? editions.at(-1)?.number ?? 0;

  const [selectedNumber, setSelectedNumber] = useState(initialNumber);
  const [viewers, setViewers] = useState<ViewerState[]>(() => initialEdition ? [{
    editionNumber: initialEdition.number,
    revision: initialEdition.map.revision,
    src: viewerUrl(initialEdition.map),
    ready: false,
  }] : []);
  // Keep an eagerly updated mirror so two adjacent preload insertions in the
  // same task see each other's cache changes before React commits a render.
  const viewersRef = useRef(viewers);

  const selectedRef = useRef(initialNumber);
  const viewerRefs = useRef(new Map<number, HTMLIFrameElement>());
  const cameraHashes = useRef(new Map<number, string>());
  const desiredCameraHashes = useRef(new Map<number, string>());
  const pendingResets = useRef(new Set<number>());
  const usageOrder = useRef(initialEdition ? [initialEdition.number] : []);
  const visitedNumbers = useRef(new Set(initialEdition ? [initialEdition.number] : []));
  // A viewer that has actually been shown stays full-quality while it remains in
  // the three-slot cache. If it is evicted and later speculatively recreated, it
  // starts lightweight again until the user selects it.
  const fullQualityViewers = useRef(new Set(initialEdition ? [initialEdition.number] : []));

  const selected = editions.find((edition) => edition.number === selectedNumber) ?? editions[0];

  const registerFrame = useCallback((editionNumber: number, frame: HTMLIFrameElement | null) => {
    if (frame) viewerRefs.current.set(editionNumber, frame);
    else viewerRefs.current.delete(editionNumber);
  }, []);

  const disposeEditionViewer = useCallback((editionNumber: number) => {
    const frame = viewerRefs.current.get(editionNumber);
    if (frame) disposeMapViewerFrame(frame);
    viewerRefs.current.delete(editionNumber);
    fullQualityViewers.current.delete(editionNumber);
  }, []);

  const postToViewer = useCallback((editionNumber: number, message: unknown) => {
    viewerRefs.current.get(editionNumber)?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  const setViewerHiresDistance = useCallback((editionNumber: number, distance: number) => {
    let appliedDirectly = false;
    try {
      const frameWindow = viewerRefs.current.get(editionNumber)?.contentWindow as BlueMapFrameWindow | null;
      appliedDirectly = applySgpHiresViewDistance(frameWindow?.bluemap, distance);
    } catch {
      // Fall through to the archive bridge.
    }
    if (!appliedDirectly) postToViewer(editionNumber, { type: "sgp-map-hires", distance });
  }, [postToViewer]);

  const readCameraHash = useCallback((editionNumber: number, flush = false) => {
    const frame = viewerRefs.current.get(editionNumber);
    let hash = cameraHashes.current.get(editionNumber) ?? "";
    try {
      const frameWindow = frame?.contentWindow as BlueMapFrameWindow | null;
      if (flush) frameWindow?.bluemap?.updatePageAddress?.();
      if (frameWindow?.location.hash) hash = frameWindow.location.hash;
    } catch {
      // Same-origin direct access is an optimization. The postMessage bridge keeps
      // camera tracking functional if browser isolation gets stricter in future.
    }
    if (hash) cameraHashes.current.set(editionNumber, hash);
    return hash;
  }, []);

  const applyCameraToViewer = useCallback((editionNumber: number, hash: string) => {
    if (!hash) return false;
    const frame = viewerRefs.current.get(editionNumber);
    try {
      const frameWindow = frame?.contentWindow as BlueMapFrameWindow | null;
      if (frameWindow?.location.pathname.startsWith("/map-archive/")) {
        // Updating the iframe URL in-place keeps an already-running BlueMap scene
        // alive. BlueMap 5.24 exposes loadPageAddress(), including on old immutable
        // archive revisions that predate the postMessage command bridge below.
        frameWindow.history.replaceState(
          frameWindow.history.state,
          "",
          `${frameWindow.location.pathname}${frameWindow.location.search}${hash}`,
        );
        if (typeof frameWindow.bluemap?.loadPageAddress === "function") {
          void Promise.resolve(frameWindow.bluemap.loadPageAddress()).catch(() => undefined);
          return true;
        }
      }
    } catch {
      // Fall through to the message bridge when direct same-origin access fails.
    }
    postToViewer(editionNumber, { type: "sgp-map-set-camera", hash });
    return false;
  }, [postToViewer]);

  const resetViewer = useCallback((editionNumber: number) => {
    const frame = viewerRefs.current.get(editionNumber);
    try {
      const frameWindow = frame?.contentWindow as BlueMapFrameWindow | null;
      if (typeof frameWindow?.bluemap?.resetCamera === "function") {
        frameWindow.bluemap.resetCamera();
        frameWindow.bluemap.updatePageAddress?.();
        const hash = frameWindow.location.hash;
        cameraHashes.current.set(editionNumber, hash);
        pendingResets.current.delete(editionNumber);
        return true;
      }
    } catch {
      // Fall through to the archive bridge.
    }
    postToViewer(editionNumber, { type: "sgp-map-reset" });
    return false;
  }, [postToViewer]);

  const markViewerReady = useCallback((editionNumber: number, postedHash?: string) => {
    if (postedHash) cameraHashes.current.set(editionNumber, postedHash);
    const nextViewers = viewersRef.current.map((viewer) => viewer.editionNumber === editionNumber && !viewer.ready
      ? { ...viewer, ready: true }
      : viewer);
    viewersRef.current = nextViewers;
    setViewers(nextViewers);

    const active = selectedRef.current === editionNumber;
    const fullQuality = active || fullQualityViewers.current.has(editionNumber);
    setViewerHiresDistance(
      editionNumber,
      fullQuality ? SGP_HIRES_VIEW_DISTANCE : SGP_PRELOAD_HIRES_VIEW_DISTANCE,
    );

    try {
      const frameWindow = viewerRefs.current.get(editionNumber)?.contentWindow as BlueMapFrameWindow | null;
      if (frameWindow?.location.hash) cameraHashes.current.set(editionNumber, frameWindow.location.hash);
    } catch {
      // The archive remains usable if direct iframe access is unavailable.
    }

    postToViewer(editionNumber, { type: "sgp-map-active", active });
    if (pendingResets.current.has(editionNumber)) {
      resetViewer(editionNumber);
      return;
    }
    const desired = desiredCameraHashes.current.get(editionNumber);
    if (desired) applyCameraToViewer(editionNumber, desired);
  }, [applyCameraToViewer, postToViewer, resetViewer, setViewerHiresDistance]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      let editionNumber: number | null = null;
      for (const [number, frame] of viewerRefs.current) {
        if (event.source === frame.contentWindow) {
          editionNumber = number;
          break;
        }
      }
      if (editionNumber === null) return;

      if (event.data?.type === "sgp-map-camera" && typeof event.data.hash === "string") {
        cameraHashes.current.set(editionNumber, event.data.hash);
        if (editionNumber === selectedRef.current) {
          setViewerHiresDistance(editionNumber, SGP_HIRES_VIEW_DISTANCE);
        }
        return;
      }

      if (event.data?.type === "sgp-map-ready") {
        markViewerReady(editionNumber, typeof event.data.hash === "string" ? event.data.hash : undefined);
        return;
      }

      if (event.data?.type === "sgp-map-reset-complete") {
        pendingResets.current.delete(editionNumber);
        if (typeof event.data.hash === "string") cameraHashes.current.set(editionNumber, event.data.hash);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [markViewerReady, setViewerHiresDistance]);

  useEffect(() => {
    selectedRef.current = selectedNumber;
    for (const viewer of viewers) {
      const active = viewer.editionNumber === selectedNumber;
      postToViewer(viewer.editionNumber, { type: "sgp-map-active", active });
      if (active) setViewerHiresDistance(viewer.editionNumber, SGP_HIRES_VIEW_DISTANCE);
    }
  }, [postToViewer, selectedNumber, setViewerHiresDistance, viewers]);

  useEffect(() => {
    const present = new Set(viewers.map((viewer) => viewer.editionNumber));
    for (const number of cameraHashes.current.keys()) if (!present.has(number)) cameraHashes.current.delete(number);
    for (const number of desiredCameraHashes.current.keys()) if (!present.has(number)) desiredCameraHashes.current.delete(number);
    for (const number of pendingResets.current) if (!present.has(number)) pendingResets.current.delete(number);
  }, [viewers]);

  const ensureViewer = useCallback((
    editionNumber: number,
    hash: string,
    mode: PreloadMode,
    protectedActiveNumber = selectedRef.current,
  ) => {
    const edition = editionByNumber.get(editionNumber);
    if (!edition) return;

    // Idle preloading owns the active + immediate-neighbor working set. It may
    // evict an older visited map only when that map is outside this set. Direct
    // selection protects the current map while the requested viewer is inserted.
    const protectedNumbers = mode === "idle"
      ? new Set([protectedActiveNumber, ...mapTimelineAdjacentNumbers(availableNumbers, protectedActiveNumber)])
      : new Set([protectedActiveNumber]);

    const current = viewersRef.current;
    if (current.some((viewer) => viewer.editionNumber === editionNumber)) return;

    let next = current;
    if (next.length >= MAP_TIMELINE_VIEWER_CACHE_SIZE) {
      const victim = mapTimelineEvictionCandidate({
        viewerNumbers: next.map((viewer) => viewer.editionNumber),
        incomingNumber: editionNumber,
        protectedNumbers,
        usageOrder: usageOrder.current,
        visitedNumbers: visitedNumbers.current,
      });
      if (victim === null) return;

      // Release the old WebGL context synchronously before removing its iframe.
      // This is what prevents repeated four-map cycling from accumulating stale
      // GPU contexts until the browser eventually decides to collect them.
      disposeEditionViewer(victim);
      next = next.filter((viewer) => viewer.editionNumber !== victim);
    }

    next = [...next, {
      editionNumber,
      revision: edition.map.revision,
      src: viewerUrl(edition.map, hash),
      ready: false,
    }];
    viewersRef.current = next;
    setViewers(next);
  }, [availableNumbers, disposeEditionViewer, editionByNumber]);

  const translatedCameraFor = useCallback((fromNumber: number, toNumber: number, flush = false) => {
    const from = editionByNumber.get(fromNumber);
    const to = editionByNumber.get(toNumber);
    if (!from || !to) return "";
    const hash = readCameraHash(fromNumber, flush);
    return hash ? translateBlueMapHash(hash, from.map.center, to.map.center) : "";
  }, [editionByNumber, readCameraHash]);

  const preloadAdjacentEdition = useCallback((number: number) => {
    if (number === selectedRef.current || !editionByNumber.has(number) || !canIdlePreload()) return;
    const translated = translatedCameraFor(selectedRef.current, number);
    ensureViewer(number, translated, "idle");
  }, [editionByNumber, ensureViewer, translatedCameraFor]);

  useEffect(() => {
    const activeViewer = viewers.find((viewer) => viewer.editionNumber === selectedNumber);
    if (!activeViewer?.ready || !canIdlePreload()) return;

    const adjacent = mapTimelineAdjacentNumbers(availableNumbers, selectedNumber);
    const present = new Set(viewers.map((viewer) => viewer.editionNumber));
    const missing = adjacent.filter((number) => !present.has(number));
    if (!missing.length) return;

    let idleId: number | null = null;
    let fallbackId: number | null = null;
    const run = () => {
      if (selectedRef.current !== selectedNumber) return;
      // Both sides are equally valuable: prewarm every missing immediate neighbor.
      for (const number of missing) preloadAdjacentEdition(number);
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 1_200 });
    } else {
      fallbackId = window.setTimeout(run, 120);
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      if (fallbackId !== null) window.clearTimeout(fallbackId);
    };
  }, [availableNumbers, preloadAdjacentEdition, selectedNumber, viewers]);

  const selectEdition = useCallback((number: number) => {
    const previousNumber = selectedRef.current;
    if (number === previousNumber || !editionByNumber.has(number)) return;
    const translated = translatedCameraFor(previousNumber, number, true);
    if (translated) desiredCameraHashes.current.set(number, translated);
    else desiredCameraHashes.current.delete(number);

    // Protect the map the user is leaving during insertion. Once the new map is
    // active, the idle predictor can slide the cache to its two actual neighbors.
    ensureViewer(number, translated, "select", previousNumber);

    visitedNumbers.current.add(number);
    fullQualityViewers.current.add(number);
    usageOrder.current = [...usageOrder.current.filter((candidate) => candidate !== number), number];
    selectedRef.current = number;
    setSelectedNumber(number);
    setViewerHiresDistance(number, SGP_HIRES_VIEW_DISTANCE);

    if (translated) applyCameraToViewer(number, translated);
  }, [applyCameraToViewer, editionByNumber, ensureViewer, setViewerHiresDistance, translatedCameraFor]);

  const reset = useCallback(() => {
    if (!selected?.map) return;
    const number = selected.number;
    desiredCameraHashes.current.delete(number);
    pendingResets.current.add(number);
    resetViewer(number);
  }, [resetViewer, selected]);

  if (!available.length) {
    return (
      <div className="map-timeline-empty">
        <p className="eyebrow">Archives 3D</p>
        <h2>Les rendus ne sont pas encore publiés.</h2>
        <p>La chronologie est prête : chaque édition apparaîtra ici dès que son rendu BlueMap aura été archivé.</p>
      </div>
    );
  }

  return (
    <section className="map-timeline" aria-label="Évolution 3D de l’Arène">
      <div className="map-timeline-toolbar">
        <div className="map-timeline-editions" role="tablist" aria-label="Éditions">
          {editions.map((edition) => {
            const active = edition.number === selectedNumber;
            return (
              <button
                key={edition.number}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!edition.map}
                className={active ? "is-active" : undefined}
                onClick={() => selectEdition(edition.number)}
                title={edition.map ? `${edition.shortTitle} — ${edition.dateLabel}` : `Édition ${edition.number} — rendu indisponible`}
              >
                <span>Éd. {edition.number}</span>
                <small>{edition.minecraftVersion}</small>
              </button>
            );
          })}
        </div>
        <button type="button" className="map-timeline-reset" onClick={reset}>
          <RotateCcw size={15} aria-hidden="true" />
          Recentrer
        </button>
      </div>

      <div className="map-timeline-frame-wrap">
        {viewers.map((viewer) => (
          <TimelineViewer
            key={`${viewer.editionNumber}:${viewer.revision}`}
            viewer={viewer}
            active={viewer.editionNumber === selectedNumber}
            onFrame={registerFrame}
            onLoad={markViewerReady}
          />
        ))}
      </div>
      <p className="map-timeline-hint">Clic gauche : déplacer · clic droit : tourner · molette ou pincement : zoomer · changer d’édition conserve le même point relatif.</p>
    </section>
  );
}
