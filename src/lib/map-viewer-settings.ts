export const SGP_HIRES_VIEW_DISTANCE = 250;
export const SGP_PRELOAD_HIRES_VIEW_DISTANCE = 125;

export type BlueMapHiresRuntime = {
  settings?: { hiresSliderDefault?: number } | null;
  mapViewer?: {
    data?: { loadedHiresViewDistance?: number } | null;
    updateLoadedMapArea?: () => void;
  } | null;
};

/**
 * Apply a BlueMap high-resolution radius. Safe to call repeatedly, including
 * against older immutable archive revisions from the same-origin timeline.
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
