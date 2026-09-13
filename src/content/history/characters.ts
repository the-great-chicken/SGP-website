export type HistoryCharacterSlug =
  | "grand-poulet"
  | "canarchimage"
  | "oielchimiste"
  | "corbeautaniste";

export type HistoryCharacter = {
  slug: HistoryCharacterSlug;
  name: string;
  kicker: string;
  summary: string;
  roleLabel: string;
  firstAppearance: 1 | 2 | 3 | 4;
  appearances: readonly (1 | 2 | 3 | 4)[];
  portrait: {
    src: string | null;
    alt: string;
  };
  editorialStatus: "draft" | "written";
};

export const historyCharacters: readonly HistoryCharacter[] = [
  {
    slug: "grand-poulet",
    name: "Grand Poulet",
    kicker: "Champion de la Haute-Cour",
    summary:
      "Figure centrale de la SGP depuis la première édition : champion célébré, organisateur dans le récit et rival du Canarchimage.",
    roleLabel: "Figure centrale de la SGP",
    firstAppearance: 1,
    appearances: [1, 2, 3, 4],
    portrait: {
      src: null,
      alt: "Portrait du Grand Poulet",
    },
    editorialStatus: "draft",
  },
  {
    slug: "canarchimage",
    name: "Canarchimage",
    kicker: "Le rival qui refuse de rester dehors",
    summary:
      "Perturbateur de la première édition, puis adversaire récurrent du Grand Poulet avant que leur rivalité ne devienne une compétition assumée.",
    roleLabel: "Rival du Grand Poulet",
    firstAppearance: 1,
    appearances: [1, 3, 4],
    portrait: {
      src: null,
      alt: "Portrait du Canarchimage",
    },
    editorialStatus: "draft",
  },
  {
    slug: "oielchimiste",
    name: "Oielchimiste",
    kicker: "Disciple du Canarchimage",
    summary:
      "Invitée de la deuxième édition sous de faux prétextes, puis représentante du camp du Canarchimage lors de la quatrième.",
    roleLabel: "Disciple du Canarchimage",
    firstAppearance: 2,
    appearances: [2, 4],
    portrait: {
      src: "/history/characters/oielchimiste.png",
      alt: "Portrait de l’Oielchimiste",
    },
    editorialStatus: "draft",
  },
  {
    slug: "corbeautaniste",
    name: "Corbeautaniste",
    kicker: "Quêtes, graines et vieilles notes",
    summary:
      "Ancien participant selon ses propres dialogues, retiré du combat et devenu le guide des quêtes du Grand Poulet à partir de la troisième édition.",
    roleLabel: "Guide du camp du Grand Poulet",
    firstAppearance: 3,
    appearances: [3, 4],
    portrait: {
      src: null,
      alt: "Portrait du Corbeautaniste",
    },
    editorialStatus: "draft",
  },
] as const;

export function getHistoryCharacter(slug: string) {
  return historyCharacters.find((character) => character.slug === slug) ?? null;
}
