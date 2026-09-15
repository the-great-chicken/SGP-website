import "server-only";
import path from "node:path";
import { readMapArchiveManifest } from "./archive";

export function getMapArchiveRoot() {
  return path.resolve(process.env.MAP_ARCHIVE_DIR ?? path.join(process.cwd(), "../map-archive"));
}

export function getMapArchivePublicRoot() {
  return path.join(getMapArchiveRoot(), "public");
}

export async function getMapArchiveManifest() {
  return readMapArchiveManifest(getMapArchivePublicRoot());
}
