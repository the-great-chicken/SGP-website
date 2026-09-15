"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapArchiveManifestEntry } from "@/map-archive/archive";
import { translateBlueMapHash } from "@/lib/map-timeline";

type TimelineEdition = {
  number: number;
  dateLabel: string;
  shortTitle: string;
  minecraftVersion: string;
  snapshotKey: string;
  map: MapArchiveManifestEntry | null;
};

type Props = { editions: TimelineEdition[] };

function viewerUrl(entry: MapArchiveManifestEntry, hash = "") {
  return `/map-archive/${entry.webPath}/index.html${hash}`;
}

export function MapTimeline({ editions }: Props) {
  const available = useMemo(() => editions.filter((edition) => edition.map), [editions]);
  const [selectedNumber, setSelectedNumber] = useState(available.at(-1)?.number ?? editions.at(-1)?.number ?? 0);
  const cameraHash = useRef("");
  const [viewerSrc, setViewerSrc] = useState(() => {
    const initial = available.at(-1)?.map;
    return initial ? viewerUrl(initial) : "";
  });
  const iframe = useRef<HTMLIFrameElement>(null);
  const selected = editions.find((edition) => edition.number === selectedNumber) ?? editions[0];

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type !== "sgp-map-camera" || typeof event.data.hash !== "string") return;
      cameraHash.current = event.data.hash;
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  const selectEdition = useCallback((number: number) => {
    const next = editions.find((edition) => edition.number === number);
    if (!next?.map) return;
    const previous = selected?.map;
    let currentHash = cameraHash.current;
    // BlueMap intentionally delays URL updates while the camera is moving. Ask the
    // same-origin frame to flush its URL before switching so a quick click does not
    // jump back to the previous camera position. Older/newer viewers can omit this
    // internal hook; the postMessage bridge remains the fallback.
    try {
      const frameWindow = iframe.current?.contentWindow as (Window & { bluemap?: { updatePageAddress?: () => void } }) | null;
      frameWindow?.bluemap?.updatePageAddress?.();
      currentHash = frameWindow?.location.hash || currentHash;
    } catch {
      // The iframe can be between navigations for a moment; use the last posted hash.
    }
    const translated = previous && currentHash
      ? translateBlueMapHash(currentHash, previous.center, next.map.center)
      : "";
    setSelectedNumber(number);
    cameraHash.current = translated;
    setViewerSrc(viewerUrl(next.map, translated));
  }, [editions, selected]);

  const reset = useCallback(() => {
    if (!selected?.map) return;
    cameraHash.current = "";
    setViewerSrc(`${viewerUrl(selected.map)}?reset=${Date.now()}`);
  }, [selected]);

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
        <iframe
          ref={iframe}
          className="map-timeline-frame"
          src={viewerSrc}
          title={`Carte 3D — édition ${selectedNumber}`}
          allow="fullscreen"
        />
      </div>
      <p className="map-timeline-hint">Glisser pour tourner · molette ou pincement pour zoomer · changer d’édition conserve le même lieu relatif.</p>
    </section>
  );
}
