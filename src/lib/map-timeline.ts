import type { MapCenter } from "@/map-archive/archive";
import { translateBlueMapCamera } from "./bluemap-camera";

export const MAP_TIMELINE_VIEWER_CACHE_SIZE = 3;

/**
 * Translate BlueMap's camera target between edition-local centers while
 * preserving distance, rotation, angle, tilt, projection and view mode.
 */
export function translateBlueMapHash(hash: string, from: MapCenter, to: MapCenter) {
  return translateBlueMapCamera(hash, from, to, { mapId: "world", hash: true });
}

/** Return the immediately adjacent archived editions, with no direction bias. */
export function mapTimelineAdjacentNumbers(
  availableNumbers: readonly number[],
  selectedNumber: number,
) {
  const index = availableNumbers.indexOf(selectedNumber);
  if (index < 0) return [];
  const adjacent: number[] = [];
  if (index > 0) adjacent.push(availableNumbers[index - 1]);
  if (index + 1 < availableNumbers.length) adjacent.push(availableNumbers[index + 1]);
  return adjacent;
}

/**
 * Pick a cache victim without disturbing the currently useful comparison set.
 * Callers supply the editions that must stay warm (normally the active edition
 * plus its immediate neighbors). Speculative entries are still preferred for
 * eviction, then the least-recently-used visited entry.
 */
export function mapTimelineEvictionCandidate(options: {
  viewerNumbers: readonly number[];
  incomingNumber: number;
  protectedNumbers: ReadonlySet<number>;
  usageOrder: readonly number[];
  visitedNumbers: ReadonlySet<number>;
}) {
  const candidates = options.viewerNumbers.filter(
    (number) => number !== options.incomingNumber && !options.protectedNumbers.has(number),
  );
  if (!candidates.length) return null;

  const speculative = candidates.filter((number) => !options.visitedNumbers.has(number));
  const pool = speculative.length ? speculative : candidates;

  for (const number of options.usageOrder) {
    if (pool.includes(number)) return number;
  }
  return pool[0] ?? null;
}
