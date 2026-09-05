import type { AuthSession } from "@/auth/session-query";
import type { CosmeticBridge } from "./bridge";
import {
  CosmeticError, errorMessage, liveView, selectionSchema,
  type CosmeticView, type Identity, type MutationResult, type Snapshot,
} from "./model";

type Store = { save(snapshot: Snapshot): Promise<void>; read(uuid: string): Promise<CosmeticView> };
// This application has one writable instance. Serialize reads and changes so an older response
// cannot overwrite the cache after a newer mutation, including requests from separate tabs.
const globalCosmetics = globalThis as typeof globalThis & {
  sgpCosmeticQueues?: Map<string, Promise<unknown>>;
};
const queues = globalCosmetics.sgpCosmeticQueues ??= new Map<string, Promise<unknown>>();
async function forPlayer<T>(uuid: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(uuid) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(operation);
  queues.set(uuid, task);
  try { return await task; }
  finally { if (queues.get(uuid) === task) queues.delete(uuid); }
}
export function requireCosmeticIdentity(session: AuthSession | null): Identity {
  if (!session || session.expiresAt.getTime() <= Date.now()) throw new CosmeticError("UNAUTHENTICATED", 401);
  if (!session.player) throw new CosmeticError("UNLINKED", 403);
  return { discordId: session.discord.id, playerUuid: session.player.uuid };
}
export function createCosmeticService(bridge: CosmeticBridge, store: Store) {
  async function observe(identity: Identity) {
    const snapshot = await bridge.read(identity);
    await store.save(snapshot);
    return snapshot;
  }
  async function fallback(identity: Identity, error: unknown): Promise<CosmeticView> {
    const code = error instanceof CosmeticError ? error.code : "UNCONFIRMED";
    if (code === "LINK_MISMATCH") {
      return { status: "link_mismatch", observedAt: null, cosmetics: [],
        equipment: { particle: null, intensity: null, kill: null }, issues: [] };
    }
    const cache = await store.read(identity.playerUuid);
    return { ...cache, status: code === "OFFLINE" ? "offline" : "unavailable" };
  }
  return {
    async read(session: AuthSession | null): Promise<CosmeticView> {
      const identity = requireCosmeticIdentity(session);
      return forPlayer(identity.playerUuid, async () => {
        requireCosmeticIdentity(session);
        try { return liveView(await observe(identity)); }
        catch (error) { return fallback(identity, error); }
      });
    },
    async change(session: AuthSession | null, input: unknown): Promise<MutationResult> {
      const identity = requireCosmeticIdentity(session);
      const parsed = selectionSchema.safeParse(input);
      if (!parsed.success) throw new CosmeticError("INVALID_REQUEST", 400);
      const selection = parsed.data;
      return forPlayer(identity.playerUuid, async () => {
        requireCosmeticIdentity(session);
        try {
          const before = await observe(identity);
          if (selection.cosmeticId !== null) {
            const cosmetic = before.catalogue.find((c) => c.id === selection.cosmeticId);
            if (!cosmetic) throw new CosmeticError("INVALID_COSMETIC", 400);
            if (cosmetic.category !== selection.category) throw new CosmeticError("INVALID_CATEGORY", 400);
            if (!before.unlocked.includes(cosmetic.id)) throw new CosmeticError("LOCKED", 403);
          }
          const after = await bridge.change(identity, selection);
          if (after.equipment[selection.category] !== selection.cosmeticId
            || after.issues.includes("multiple:" + selection.category)) throw new CosmeticError("UNCONFIRMED");
          const view = liveView(after);
          try { await store.save(after); }
          catch {
            return { confirmed: true, view, message: "Équipement confirmé dans Minecraft. La copie du site n’a pas pu être enregistrée ; actualisez avant de quitter." };
          }
          return { confirmed: true, view, message: "Équipement confirmé dans Minecraft." };
        } catch (error) {
          let view: CosmeticView;
          // A lost response can follow a successful Minecraft change. Read, never blindly replay.
          try { view = liveView(await observe(identity)); }
          catch (refreshError) { view = await fallback(identity, refreshError); }
          const code = error instanceof CosmeticError ? error.code : "UNCONFIRMED";
          return { confirmed: false, message: errorMessage(code), view };
        }
      });
    },
  };
}
