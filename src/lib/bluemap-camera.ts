export type BlueMapCameraCenter = {
  x: number;
  y: number;
  z: number;
};

export type ParsedBlueMapCamera = {
  mapId: string;
  x: number;
  y: number;
  z: number;
  fields: [string, string, string, string, string, string];
  view: string;
  hadHash: boolean;
};

function finite(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseBlueMapCamera(value: string): ParsedBlueMapCamera | null {
  const hadHash = value.startsWith("#");
  const raw = hadHash ? value.slice(1) : value;
  const parts = raw.split(":");
  // BlueMap 5.24 serializes map:x:y:z:distance:rotation:angle:tilt:ortho:view.
  if (parts.length !== 10 || !parts[0]) return null;

  const numeric = parts.slice(1, 9).map(finite);
  if (numeric.some((item) => item === null)) return null;
  const [x, y, z] = numeric as number[];

  return {
    mapId: parts[0],
    x,
    y,
    z,
    fields: [parts[4], parts[5], parts[6], parts[7], parts[8], parts[9]],
    view: parts[9],
    hadHash,
  };
}

function formatCoordinate(value: number) {
  if (Object.is(value, -0)) return "0";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(12)));
}

/**
 * Translate only a BlueMap camera target's XYZ offset between corresponding
 * edition centers. All view fields after XYZ are preserved verbatim.
 */
export function translateBlueMapCamera(
  value: string,
  from: BlueMapCameraCenter,
  to: BlueMapCameraCenter,
  options: { mapId?: string; hash?: boolean } = {},
) {
  const parsed = parseBlueMapCamera(value);
  if (!parsed) return "";

  const mapId = options.mapId ?? parsed.mapId;
  const translated = [
    mapId,
    formatCoordinate(parsed.x - from.x + to.x),
    formatCoordinate(parsed.y - from.y + to.y),
    formatCoordinate(parsed.z - from.z + to.z),
    ...parsed.fields,
  ].join(":");
  const includeHash = options.hash ?? parsed.hadHash;
  return includeHash ? `#${translated}` : translated;
}
