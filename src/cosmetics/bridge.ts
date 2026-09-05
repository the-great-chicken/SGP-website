import { randomUUID } from "node:crypto";
import { CosmeticError, snapshotSchema, type Identity, type Selection, type Snapshot } from "./model";

export interface CosmeticBridge {
  read(identity: Identity): Promise<Snapshot>;
  change(identity: Identity, selection: Selection): Promise<Snapshot>;
}
export function createCosmeticBridge(
  config: { url?: string; secret?: string },
  fetchImplementation: typeof fetch = fetch,
): CosmeticBridge {
  async function request(path: string, method: string, identity: Identity, extra = {}): Promise<Snapshot> {
    if (!config.url || !config.secret || !/^[A-Za-z0-9_-]{32,}$/.test(config.secret)) {
      throw new CosmeticError("BRIDGE_UNAVAILABLE");
    }
    const url = new URL(config.url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
      throw new CosmeticError("BRIDGE_UNAVAILABLE");
    }
    try {
      const response = await fetchImplementation(new URL(path, url), {
        method,
        headers: { Authorization: `Bearer ${config.secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...identity, ...extra }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
      const text = await readBoundedText(response, 65_536);
      const body: unknown = JSON.parse(text);
      if (!response.ok) {
        const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error : "UNCONFIRMED";
        throw new CosmeticError(code, response.status);
      }
      const snapshot = snapshotSchema.parse(body);
      if (snapshot.playerUuid !== identity.playerUuid) throw new CosmeticError("UNCONFIRMED");
      return snapshot;
    } catch (error) {
      if (error instanceof CosmeticError) throw error;
      throw new CosmeticError("UNCONFIRMED");
    }
  }
  return {
    read: (identity) => request("/v1/state", "POST", identity),
    change: (identity, selection) => request("/v1/equipment", "PUT", identity, {
      ...selection, requestId: randomUUID(), issuedAt: Date.now(),
    }),
  };
}
export async function readBoundedText(response: Response | Request, limit: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new CosmeticError("INVALID_REQUEST", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new CosmeticError("INVALID_REQUEST", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}
