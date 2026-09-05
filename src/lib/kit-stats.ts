export type KitAggregateStats = {
  picks: number;
  totalTimeTicks: number;
  kills: number;
  deaths: number;
  damageDealt: number;
};

export type KitStatsSnapshot = {
  editionCount: number;
  totalPicks: number;
  byKitKey: Record<string, KitAggregateStats>;
};

export type KitMetric = {
  label: string;
  value: string;
  detail: string;
};

const compactNumber = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const decimalNumber = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function getKitMetrics(
  kitId: number | null,
  stats: KitAggregateStats | undefined,
  snapshot: Pick<KitStatsSnapshot, "editionCount" | "totalPicks">,
): KitMetric[] {
  if (kitId === null) {
    return emptyMetrics("Hors compétition");
  }
  if (snapshot.editionCount === 0) {
    return emptyMetrics("Aucune édition publiée");
  }

  const values = stats ?? emptyStats();
  const popularity = snapshot.totalPicks > 0 ? (values.picks / snapshot.totalPicks) * 100 : 0;
  const ratio = values.deaths > 0 ? values.kills / values.deaths : null;
  const damagePerMinute =
    values.totalTimeTicks > 0 ? (values.damageDealt * 1_200) / values.totalTimeTicks : null;

  return [
    {
      label: "Popularité",
      value: `${decimalNumber.format(popularity)} %`,
      detail: `${compactNumber.format(values.picks)} sélection${values.picks > 1 ? "s" : ""}`,
    },
    {
      label: "Ratio E/M",
      value: ratio === null ? "—" : decimalNumber.format(ratio),
      detail: `${compactNumber.format(values.kills)} élim. · ${compactNumber.format(values.deaths)} morts`,
    },
    {
      label: "Dégâts/min",
      value: damagePerMinute === null ? "—" : decimalNumber.format(damagePerMinute),
      detail: `${compactNumber.format(values.damageDealt)} dégâts cumulés`,
    },
  ];
}

export function emptyStats(): KitAggregateStats {
  return {
    picks: 0,
    totalTimeTicks: 0,
    kills: 0,
    deaths: 0,
    damageDealt: 0,
  };
}

function emptyMetrics(detail: string): KitMetric[] {
  return ["Popularité", "Ratio E/M", "Dégâts/min"].map((label) => ({
    label,
    value: "—",
    detail,
  }));
}
