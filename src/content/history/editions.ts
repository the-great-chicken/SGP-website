export type HistoryEditionStatus = "published" | "planned";

export type HistoryEdition = {
  number: 1 | 2 | 3 | 4;
  year: number;
  dateIso: string;
  dateLabel: string;
  name: string;
  shortTitle: string;
  subtitle: string | null;
  locationLabel: string;
  minecraftVersion: string;
  summary: string;
  status: HistoryEditionStatus;
  map: {
    snapshotKey: string;
    previewSrc: string | null;
  };
};

export const historyEditions: readonly HistoryEdition[] = [
  {
    number: 1,
    year: 2023,
    dateIso: "2023-06-03",
    dateLabel: "3 juin 2023",
    name: "Soirée PvP Suprême (de Poulet)",
    shortTitle: "Les origines",
    subtitle: null,
    locationLabel: "La Haute-Cour",
    minecraftVersion: "1.15.2",
    summary:
      "La première Haute-Cour, douze kits, trois grands événements et l’arrivée du Canarchimage : la grammaire de la SGP se met en place en une soirée.",
    status: "published",
    map: {
      snapshotKey: "edition-1",
      previewSrc: null,
    },
  },
  {
    number: 2,
    year: 2023,
    dateIso: "2023-08-27",
    dateLabel: "27 août 2023",
    name: "2e édition de la Soirée PvP Suprême (de Poulet)",
    shortTitle: "La Haute-Cour se transforme",
    subtitle: "Découvertes, Défis et Transmutations",
    locationLabel: "La Haute-Cour",
    minecraftVersion: "1.20.1",
    summary:
      "La Haute-Cour est profondément remaniée sans changer de périmètre, de nouveaux jeux apparaissent et l’Oielchimiste entre dans l’histoire.",
    status: "planned",
    map: {
      snapshotKey: "edition-2",
      previewSrc: null,
    },
  },
  {
    number: 3,
    year: 2024,
    dateIso: "2024-04-06",
    dateLabel: "6 avril 2024",
    name: "3e édition de la Soirée du Grand Poulet",
    shortTitle: "Quêtes et exploration",
    subtitle: "Exploration, Quêtes et Botanique",
    locationLabel: "L’Arène",
    minecraftVersion: "1.20.2",
    summary:
      "La soirée devient aussi une aventure : quêtes, cosmétiques, Corbeautaniste, Grosse Énigme et retour du Canarchimage transforment l’expérience.",
    status: "planned",
    map: {
      snapshotKey: "edition-3",
      previewSrc: null,
    },
  },
  {
    number: 4,
    year: 2024,
    dateIso: "2024-08-31",
    dateLabel: "31 août 2024",
    name: "4e édition de la Soirée du Grand Poulet",
    shortTitle: "Deux camps, une Arène",
    subtitle: "Profondeurs, Discorde et Harmonie",
    locationLabel: "L’Arène",
    minecraftVersion: "1.21.1",
    summary:
      "Le Grand Poulet et le Canarchimage règlent leur rivalité à travers deux factions, pendant que l’Arène gagne de nouveaux espaces souterrains et de nouvelles façons de jouer.",
    status: "planned",
    map: {
      snapshotKey: "edition-4",
      previewSrc: null,
    },
  },
] as const;

export function getHistoryEdition(number: number) {
  return historyEditions.find((edition) => edition.number === number) ?? null;
}

export function publishedHistoryEditions() {
  return historyEditions.filter((edition) => edition.status === "published");
}
