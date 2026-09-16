export const SGP_HIRES_VIEW_DISTANCE = 250;

export type BlueMapHiresRuntime = {
  settings?: { hiresSliderDefault?: number } | null;
  mapViewer?: {
    data?: { loadedHiresViewDistance?: number } | null;
    updateLoadedMapArea?: () => void;
  } | null;
};

/**
 * Keep the normal archive viewer at the same high-resolution radius as the live
 * map. This is intentionally safe to call repeatedly, including against older
 * immutable archive revisions from the same-origin timeline iframe.
 */
export function applySgpHiresViewDistance(
  bluemap: BlueMapHiresRuntime | null | undefined,
  distance = SGP_HIRES_VIEW_DISTANCE,
) {
  if (!bluemap?.settings || !bluemap.mapViewer?.data || !Number.isFinite(distance) || distance < 0) return false;
  const changed = bluemap.settings.hiresSliderDefault !== distance
    || bluemap.mapViewer.data.loadedHiresViewDistance !== distance;
  bluemap.settings.hiresSliderDefault = distance;
  bluemap.mapViewer.data.loadedHiresViewDistance = distance;
  if (changed) bluemap.mapViewer.updateLoadedMapArea?.();
  return true;
}
