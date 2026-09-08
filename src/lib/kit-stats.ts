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

export type KitMetricKey = "popularity" | "ratio" | "damagePerMinute";

export type KitMetric = {
  key: KitMetricKey;
  label: string;
  value: string;
  detail: string;
  rawValue: number | null;
};

export type KitMetricDomain = {
  min: number;
  midpoint: number;
  max: number;
};

export type KitMetricDomains = Record<KitMetricKey, KitMetricDomain | null>;

type ComparableKit = {
  id: number | null;
  key: string;
};

const compactNumber = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const decimalNumber = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const scaleStops = {
  low: [239, 140, 130],
  midpoint: [226, 199, 119],
  high: [139, 203, 164],
} as const;

export function getKitMetricValues(
  stats: KitAggregateStats | undefined,
  snapshot: Pick<KitStatsSnapshot, "editionCount" | "totalPicks">,
) {
  if (snapshot.editionCount === 0) {
    return {
      popularity: null,
      ratio: null,
      damagePerMinute: null,
    } satisfies Record<KitMetricKey, number | null>;
  }

  const values = stats ?? emptyStats();
  const popularity = snapshot.totalPicks > 0 ? (values.picks / snapshot.totalPicks) * 100 : 0;
  const ratio = values.deaths > 0 ? values.kills / values.deaths : null;
  const damagePerMinute =
    values.totalTimeTicks > 0 ? (values.damageDealt * 1_200) / values.totalTimeTicks : null;

  return { popularity, ratio, damagePerMinute } satisfies Record<KitMetricKey, number | null>;
}

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
  const metricValues = getKitMetricValues(values, snapshot);

  return [
    {
      key: "popularity",
      label: "Popularité",
      value: `${decimalNumber.format(metricValues.popularity ?? 0)} %`,
      detail: `${compactNumber.format(values.picks)} sélection${values.picks > 1 ? "s" : ""}`,
      rawValue: metricValues.popularity,
    },
    {
      key: "ratio",
      label: "Ratio E/M",
      value: metricValues.ratio === null ? "—" : decimalNumber.format(metricValues.ratio),
      detail: `${compactNumber.format(values.kills)} élim. · ${compactNumber.format(values.deaths)} morts`,
      rawValue: metricValues.ratio,
    },
    {
      key: "damagePerMinute",
      label: "Dégâts/min",
      value:
        metricValues.damagePerMinute === null ? "—" : decimalNumber.format(metricValues.damagePerMinute),
      detail: `${compactNumber.format(values.damageDealt)} dégâts cumulés`,
      rawValue: metricValues.damagePerMinute,
    },
  ];
}

export function getKitMetricDomains(
  kits: ComparableKit[],
  snapshot: KitStatsSnapshot,
): KitMetricDomains {
  if (snapshot.editionCount === 0) {
    return emptyDomains();
  }

  const valuesByMetric: Record<KitMetricKey, number[]> = {
    popularity: [],
    ratio: [],
    damagePerMinute: [],
  };

  for (const kit of kits) {
    if (kit.id === null) continue;
    const values = getKitMetricValues(snapshot.byKitKey[kit.key], snapshot);
    for (const key of Object.keys(valuesByMetric) as KitMetricKey[]) {
      const value = values[key];
      if (value !== null && Number.isFinite(value)) {
        valuesByMetric[key].push(value);
      }
    }
  }

  return {
    popularity: buildMedianDomain(valuesByMetric.popularity),
    ratio: buildAnchoredDomain(valuesByMetric.ratio, 1),
    damagePerMinute: buildMedianDomain(valuesByMetric.damagePerMinute),
  };
}

export function getKitMetricColor(
  value: number | null,
  domain: KitMetricDomain | null | undefined,
): string | undefined {
  if (value === null || !domain || !Number.isFinite(value)) {
    return undefined;
  }

  if (domain.min === domain.max) {
    return rgb(scaleStops.midpoint);
  }

  if (value <= domain.midpoint) {
    const denominator = domain.midpoint - domain.min;
    if (denominator <= 0) {
      return rgb(scaleStops.midpoint);
    }
    return rgb(interpolateColor(scaleStops.low, scaleStops.midpoint, (value - domain.min) / denominator));
  }

  const denominator = domain.max - domain.midpoint;
  if (denominator <= 0) {
    return rgb(scaleStops.midpoint);
  }
  return rgb(interpolateColor(scaleStops.midpoint, scaleStops.high, (value - domain.midpoint) / denominator));
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
  return [
    ["popularity", "Popularité"],
    ["ratio", "Ratio E/M"],
    ["damagePerMinute", "Dégâts/min"],
  ].map(([key, label]) => ({
    key: key as KitMetricKey,
    label,
    value: "—",
    detail,
    rawValue: null,
  }));
}

function emptyDomains(): KitMetricDomains {
  return {
    popularity: null,
    ratio: null,
    damagePerMinute: null,
  };
}

function buildMedianDomain(values: number[]): KitMetricDomain | null {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const middle = Math.floor(sorted.length / 2);
  const midpoint =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return { min, midpoint, max };
}

function buildAnchoredDomain(values: number[], midpoint: number): KitMetricDomain | null {
  if (!values.length) return null;
  return {
    min: Math.min(midpoint, ...values),
    midpoint,
    max: Math.max(midpoint, ...values),
  };
}

function interpolateColor(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  amount: number,
): [number, number, number] {
  const t = Math.min(1, Math.max(0, amount));
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
  ];
}

function rgb(value: readonly [number, number, number]) {
  return `rgb(${value[0]} ${value[1]} ${value[2]})`;
}
