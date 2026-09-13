export type HistoryChangelogEdition = 2 | 3 | 4;

export type HistoryChangelogSection = {
  id: string;
  label: string;
};

export type HistoryChangelog = {
  edition: HistoryChangelogEdition;
  title: string;
  subtitle: string;
  sections: readonly HistoryChangelogSection[];
};

export const historyChangelogs: readonly HistoryChangelog[] = [
  {
    edition: 2,
    title: "Notes de Mise à jour 2e édition",
    subtitle: "SPS (Soirée PvP Suprême)",
    sections: [
      { id: "kits", label: "Kits" },
      { id: "evenements-majeurs", label: "Événements majeurs" },
      { id: "evenements-mineurs", label: "Événements mineurs" },
      { id: "lieux-nommes", label: "Lieux nommés" },
      { id: "map", label: "Map" },
      { id: "interface-utilisateur", label: "Interface utilisateur" },
      { id: "resource-pack", label: "Resource pack" },
      { id: "correction-de-bugs", label: "Correction de bugs" },
    ],
  },
  {
    edition: 3,
    title: "Notes de Mise à jour 3e édition",
    subtitle: "SGP (Soirée du Grand Poulet)",
    sections: [
      { id: "kits", label: "Kits" },
      { id: "cosmetiques", label: "Cosmétiques" },
      { id: "quetes", label: "Quêtes" },
      { id: "evenements-majeurs", label: "Événements majeurs" },
      { id: "evenements-mineurs", label: "Événements mineurs" },
      { id: "map", label: "Map" },
      { id: "interface-utilisateur", label: "Interface utilisateur" },
      { id: "resource-pack", label: "Resource pack" },
      { id: "correction-de-bugs", label: "Correction de bugs" },
    ],
  },
  {
    edition: 4,
    title: "Notes de Mise à jour 4e édition",
    subtitle: "SGP (Soirée du Grand Poulet)",
    sections: [
      { id: "kits", label: "Kits" },
      { id: "qol", label: "QOL" },
      { id: "mode-paisible", label: "Mode Paisible" },
      { id: "quetes", label: "Quêtes" },
      { id: "cosmetiques", label: "Cosmétiques" },
      { id: "evenements-majeurs", label: "Événements majeurs" },
      { id: "evenements-mineurs", label: "Événements mineurs" },
      { id: "map", label: "Map" },
      { id: "interface-utilisateur", label: "Interface utilisateur" },
      { id: "resource-pack", label: "Resource pack" },
      { id: "correction-de-bugs", label: "Correction de bugs" },
      { id: "en-arriere-plan", label: "En Arrière-Plan" },
    ],
  },
] as const;

export function getHistoryChangelog(edition: number) {
  return historyChangelogs.find((changelog) => changelog.edition === edition) ?? null;
}

export function hasHistoryChangelog(edition: number): edition is HistoryChangelogEdition {
  return historyChangelogs.some((changelog) => changelog.edition === edition);
}
