import { readFile } from "node:fs/promises";
import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const resourceLocation = z.string().regex(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/);
const pathIdentifier = z.string().regex(/^[a-z0-9_]+$/);
const kitId = z.int().min(-1);
const dateTime = z
  .string()
  .refine(
    (value) => /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
    "Expected an ISO 8601 datetime with a timezone",
  );

type JsonValue = boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ]),
);

const kitItem = z
  .object({
    id: resourceLocation,
    count: z.int().positive(),
    components: z.record(resourceLocation, jsonValue),
    removedComponents: z.array(resourceLocation),
  })
  .strict();

const sourceLocation = z
  .object({
    line: z.int().positive(),
    endLine: z.int().positive(),
  })
  .strict();

const kitOperation = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("give"),
      item: kitItem,
      source: sourceLocation,
    })
    .strict(),
  z
    .object({
      kind: z.literal("replace"),
      slot: z.string().min(1),
      item: kitItem,
      source: sourceLocation,
    })
    .strict(),
]);

const kitAbility = z
  .object({
    path: pathIdentifier,
    name: z.string().min(1),
    description: z.string().min(1),
    activationKeybind: z.string().regex(/^key\./),
    descriptionComponents: z.array(jsonValue).min(1),
  })
  .strict();

export const kitManifestSchema = z
  .object({
    $schema: z.literal("../schemas/kit-manifest.schema.json"),
    schemaVersion: z.literal(2),
    minecraftVersion: z.string().min(1),
    dataPack: z
      .object({
        id: z.string().min(1),
        minFormat: z.number(),
        maxFormat: z.number(),
      })
      .strict(),
    kits: z
      .array(
        z
          .object({
            id: z.int().nonnegative().nullable(),
            key: pathIdentifier,
            name: z.string().min(1).nullable(),
            color: z.string().min(1).nullable(),
            icon: z.string().min(1).nullable(),
            ability: kitAbility.nullable(),
            function: resourceLocation,
            operations: z.array(kitOperation).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const abilityMetricSource = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ability_field"),
      field: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("damage_received"),
      kitId: z.int().nonnegative(),
      causeIds: z.array(z.int()).min(1),
      excludeSelf: z.boolean(),
    })
    .strict(),
]);

export const editionBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    edition: z
      .object({
        number: z.int().positive(),
        name: z.string().min(1).nullable(),
        status: z.enum(["draft", "published", "archived"]),
        startsAt: dateTime.nullable(),
        endsAt: dateTime.nullable(),
        publishedAt: dateTime.nullable(),
        minecraftVersion: z.string().min(1),
        datapackVersion: z.string().min(1).nullable(),
        resourcePackVersion: z.string().min(1).nullable(),
        statisticsSchemaVersion: z.int().positive(),
      })
      .strict(),
    kitManifest: kitManifestSchema,
    players: z.array(
      z
        .object({
          sgpId: z.int().positive(),
          uuid,
          minecraftName: z.string().min(1),
        })
        .strict(),
    ),
    damageCauses: z.array(
      z.object({ id: z.int(), name: z.string().min(1) }).strict(),
    ),
    kills: z.array(
      z
        .object({
          killerUuid: uuid.nullable(),
          killerKitId: kitId,
          victimUuid: uuid.nullable(),
          victimKitId: kitId,
          causeId: z.int(),
          count: z.int().positive(),
        })
        .strict(),
    ),
    damageReceived: z.array(
      z
        .object({
          targetUuid: uuid,
          targetKitId: kitId,
          sourceUuid: uuid.nullable(),
          sourceKitId: kitId,
          causeId: z.int(),
          amount: z.number().nonnegative(),
        })
        .strict(),
    ),
    picks: z.array(
      z
        .object({
          playerUuid: uuid,
          kitId,
          totalTimeTicks: z.int().nonnegative(),
          count: z.int().nonnegative(),
        })
        .strict(),
    ),
    abilityMetricDefinitions: z.array(
      z
        .object({
          kitId: z.int().nonnegative(),
          abilityPath: pathIdentifier,
          metricId: pathIdentifier,
          name: z.string().min(1),
          description: z.string(),
          cooldownTicks: z.int().nonnegative().nullable(),
          durationTicks: z.int().nonnegative().nullable(),
          settings: z.record(z.string(), jsonValue).nullable(),
          storedUnit: z.string().min(1),
          displayUnit: z.string().min(1),
          displayScale: z.number().positive(),
          source: abilityMetricSource,
        })
        .strict(),
    ),
    abilityMetrics: z.array(
      z
        .object({
          playerUuid: uuid,
          kitId: z.int().nonnegative(),
          abilityPath: pathIdentifier,
          metricId: pathIdentifier,
          value: z.number().nonnegative(),
        })
        .strict(),
    ),
    deathPositions: z
      .object({
        metadata: z
          .object({
            storedUnit: z.string().min(1),
            displayUnit: z.string().min(1),
            displayScale: z.number().positive(),
            quantization: z.string().min(1),
            positionReference: z.string().min(1),
          })
          .strict(),
        entries: z.array(
          z
            .object({
              dimension: resourceLocation,
              x: z.number(),
              y: z.number(),
              z: z.number(),
              deaths: z.int().positive(),
            })
            .strict(),
        ),
      })
      .strict(),
    elo: z
      .object({
        metadata: z
          .object({
            initialRating: z.number(),
            kFactor: z.number().positive(),
            ratingDivisor: z.number().positive(),
            metrics: z.array(
              z
                .object({
                  id: pathIdentifier,
                  name: z.string().min(1),
                  description: z.string(),
                  storedUnit: z.string().min(1),
                  displayUnit: z.string().min(1),
                  displayScale: z.number().positive(),
                })
                .strict(),
            ),
          })
          .strict(),
        ratings: z.array(
          z
            .object({
              playerUuid: uuid,
              rating: z.number(),
              ratedEncounters: z.int().nonnegative(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((bundle, context) => {
    if (bundle.edition.minecraftVersion !== bundle.kitManifest.minecraftVersion) {
      context.addIssue({
        code: "custom",
        message: "Edition and kit-manifest Minecraft versions differ",
        path: ["edition", "minecraftVersion"],
      });
    }
    if (bundle.edition.status === "published" && bundle.edition.publishedAt === null) {
      context.addIssue({
        code: "custom",
        message: "Published editions require publishedAt",
        path: ["edition", "publishedAt"],
      });
    }
  });

export type EditionBundle = z.infer<typeof editionBundleSchema>;

export async function readEditionBundle(path: string): Promise<EditionBundle> {
  let input: unknown;
  try {
    input = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read edition bundle ${path}`, { cause: error });
  }

  const result = editionBundleSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid edition bundle ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
