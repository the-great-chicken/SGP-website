import type { MapCenter } from "@/map-archive/archive";
import { translateBlueMapCamera } from "./bluemap-camera";

/**
 * Translate BlueMap's camera target between edition-local centers while
 * preserving distance, rotation, angle, tilt, projection and view mode.
 */
export function translateBlueMapHash(hash: string, from: MapCenter, to: MapCenter) {
  return translateBlueMapCamera(hash, from, to, { mapId: "world", hash: true });
}
