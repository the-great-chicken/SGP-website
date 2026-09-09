export const kitManifest = {
  schemaVersion: 3,
  datapackRelease: "e2e-datapack",
  resourcePackRelease: "e2e-resource-pack",
  minecraftVersion: "26.1",
  dataPack: { id: "sgp-e2e", minFormat: 101.1, maxFormat: 101.1 },
  kits: [
    {
      id: 7,
      key: "warrior",
      name: "Guerrier",
      color: "red",
      icon: null,
      ability: {
        path: "fortify",
        name: "Fortification",
        description: "Résiste brièvement aux assauts.",
        activationKeybind: "key.use",
        descriptionComponents: [],
      },
      function: "sgp:kits/warrior",
      operations: [
        {
          kind: "replace",
          slot: "hotbar.1",
          item: { id: "minecraft:golden_apple", count: 2, components: {}, removedComponents: [] },
          source: { line: 1, endLine: 1 },
        },
      ],
    },
    {
      id: 8,
      key: "mage",
      name: "Mage",
      color: "blue",
      icon: null,
      ability: {
        path: "fireball",
        name: "Boule de feu",
        description: "Projette une boule de feu vers la cible.",
        activationKeybind: "key.drop",
        descriptionComponents: [],
      },
      function: "sgp:kits/mage",
      operations: [
        {
          kind: "replace",
          slot: "hotbar.1",
          item: { id: "minecraft:blaze_powder", count: 1, components: {}, removedComponents: [] },
          source: { line: 1, endLine: 1 },
        },
      ],
    },
  ],
} as const;
