import { z } from "zod";

export const categories = ["particle", "intensity", "kill"] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;
export const categoryLabels: Record<Category, string> = {
  particle: "Traînées de particules",
  intensity: "Intensité des particules",
  kill: "Effets d’élimination",
};
const cosmeticId = z.string().regex(/^(particle|intensity|kill)\.[a-z_]+$/);
export const selectionSchema = z.strictObject({
  category: categorySchema,
  cosmeticId: cosmeticId.nullable(),
});
export type Selection = z.infer<typeof selectionSchema>;
export const catalogueEntrySchema = z.strictObject({
  id: cosmeticId,
  category: categorySchema,
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.number().int().nonnegative(),
});
export type Cosmetic = z.infer<typeof catalogueEntrySchema>;
export const snapshotSchema = z.strictObject({
  protocolVersion: z.literal(2),
  playerUuid: z.uuid(),
  observedAt: z.number().int().positive(),
  catalogue: z.array(catalogueEntrySchema).min(1).max(128),
  unlocked: z.array(cosmeticId).max(128),
  equipment: z.strictObject({
    particle: cosmeticId.nullable(),
    intensity: cosmeticId.nullable(),
    kill: cosmeticId.nullable(),
  }),
  issues: z.array(z.string().max(200)).max(128),
}).superRefine((snapshot, ctx) => {
  const catalogue = new Map(snapshot.catalogue.map((c) => [c.id, c]));
  const invalid = catalogue.size !== snapshot.catalogue.length
    || snapshot.catalogue.some((c) => !c.id.startsWith(c.category + "."))
    || new Set(snapshot.unlocked).size !== snapshot.unlocked.length
    || snapshot.unlocked.some((id) => !catalogue.has(id))
    || categories.some((category) => {
      const id = snapshot.equipment[category];
      return id !== null && catalogue.get(id)?.category !== category;
    });
  if (invalid) ctx.addIssue({ code: "custom", message: "Inconsistent cosmetic snapshot" });
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Identity = { discordId: string; playerUuid: string };
export type CosmeticView = {
  status: "live" | "offline" | "unavailable" | "link_mismatch";
  observedAt: number | null;
  cosmetics: Cosmetic[];
  equipment: Record<Category, Cosmetic | null>;
  issues: string[];
  icons?: Record<string, string>;
};
export type MutationResult = { confirmed: boolean; message: string; view: CosmeticView };
export class CosmeticError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export const messages: Record<string, string> = {
  UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous avec Discord.",
  UNLINKED: "Liez votre compte Minecraft dans DiscordSRV pour gérer vos cosmétiques.",
  LINK_MISMATCH: "La liaison DiscordSRV a changé. Demandez une resynchronisation des comptes du site.",
  LINK_UNAVAILABLE: "La liaison DiscordSRV ne peut pas être vérifiée pour le moment.",
  OFFLINE: "Connectez-vous au serveur Minecraft pour modifier votre équipement.",
  LOCKED: "Ce cosmétique n’est pas débloqué sur le serveur Minecraft.",
  INVALID_CATEGORY: "Cette catégorie ne correspond pas au cosmétique demandé.",
  INVALID_COSMETIC: "Ce cosmétique n’est plus disponible.",
  INVALID_REQUEST: "Cette sélection n’est pas valide.",
  INCONSISTENT_STATE: "Le serveur contient un cosmétique inconnu. Un administrateur doit vérifier votre équipement.",
  EXPIRED_REQUEST: "Cette demande a expiré. Actualisez votre équipement avant de réessayer.",
  UNCONFIRMED: "La modification n’a pas pu être confirmée. Vérifiez l’équipement après actualisation avant de réessayer.",
};
export function errorMessage(code: string) { return messages[code] ?? messages.UNCONFIRMED; }
export function liveView(snapshot: Snapshot): CosmeticView {
  return {
    status: "live",
    observedAt: snapshot.observedAt,
    cosmetics: snapshot.catalogue.filter((c) => snapshot.unlocked.includes(c.id)),
    equipment: Object.fromEntries(categories.map((category) => [
      category, snapshot.catalogue.find((c) => c.id === snapshot.equipment[category]) ?? null,
    ])) as CosmeticView["equipment"],
    issues: snapshot.issues,
  };
}
