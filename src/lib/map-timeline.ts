import type { MapCenter } from "@/map-archive/archive";

function finite(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * BlueMap's camera anchor starts with map-id:x:y:z. Preserve every later camera
 * field verbatim so this bridge is insensitive to BlueMap adding/changing view
 * options. Only the coordinates need translating between edition-local centers.
 */
export function translateBlueMapHash(hash: string, from: MapCenter, to: MapCenter) {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = value.split(":");
  // BlueMap 5.24 serializes map:x:y:z:distance:rotation:angle:tilt:ortho:view.
  if (parts.length !== 10) return "";
  const x = finite(parts[1]);
  const y = finite(parts[2]);
  const z = finite(parts[3]);
  if (x === null || y === null || z === null) return "";

  parts[0] = "world";
  parts[1] = String(x - from.x + to.x);
  parts[2] = String(y - from.y + to.y);
  parts[3] = String(z - from.z + to.z);
  return `#${parts.join(":")}`;
}
