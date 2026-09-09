import type { PlayerKitEditionStats } from "@/db/historical-stats-query";

export type PlayerKitComparisonMetric =
  | "picks"
  | "kills"
  | "deaths"
  | "ratio"
  | "damageDealt"
  | "damageReceived"
  | "damagePerMinute";

export type PlayerKitMetricDomain = {
  min: number;
  average: number;
  max: number;
};

export type PlayerKitMetricDomains = Record<PlayerKitComparisonMetric, PlayerKitMetricDomain | null>;

const metricDirections: Record<PlayerKitComparisonMetric, "higher" | "lower"> = {
  picks: "higher",
  kills: "higher",
  deaths: "lower",
  ratio: "higher",
  damageDealt: "higher",
  damageReceived: "lower",
  damagePerMinute: "higher",
};

const scaleStops = {
  low: [239, 140, 130],
  midpoint: [226, 199, 119],
  high: [139, 203, 164],
} as const;

export function getPlayerKitMetricValues(
  kit: Pick<
    PlayerKitEditionStats,
    "picks" | "kills" | "deaths" | "damageDealt" | "damageReceived" | "totalTimeTicks"
  >,
): Record<PlayerKitComparisonMetric, number | null> {
  const ratio = kit.deaths > 0 ? kit.kills / kit.deaths : null;
  const damagePerMinute = kit.totalTimeTicks > 0
    ? (kit.damageDealt * 1_200) / kit.totalTimeTicks
    : null;

  return {
    picks: kit.picks,
    kills: kit.kills,
    deaths: kit.deaths,
    ratio,
    damageDealt: kit.damageDealt,
    damageReceived: kit.damageReceived,
    damagePerMinute,
  };
}

export function getPlayerKitMetricDomains(
  kits: Array<Pick<
    PlayerKitEditionStats,
    "picks" | "kills" | "deaths" | "damageDealt" | "damageReceived" | "totalTimeTicks"
  >>,
): PlayerKitMetricDomains {
  const valuesByMetric: Record<PlayerKitComparisonMetric, number[]> = {
    picks: [],
    kills: [],
    deaths: [],
    ratio: [],
    damageDealt: [],
    damageReceived: [],
    damagePerMinute: [],
  };

  for (const kit of kits) {
    const values = getPlayerKitMetricValues(kit);
    for (const metric of Object.keys(values) as PlayerKitComparisonMetric[]) {
      const value = values[metric];
      if (value !== null && Number.isFinite(value)) valuesByMetric[metric].push(value);
    }
  }

  return {
    picks: buildDomain(valuesByMetric.picks),
    kills: buildDomain(valuesByMetric.kills),
    deaths: buildDomain(valuesByMetric.deaths),
    ratio: buildDomain(valuesByMetric.ratio),
    damageDealt: buildDomain(valuesByMetric.damageDealt),
    damageReceived: buildDomain(valuesByMetric.damageReceived),
    damagePerMinute: buildDomain(valuesByMetric.damagePerMinute),
  };
}

export function getPlayerKitMetricColor(
  metric: PlayerKitComparisonMetric,
  value: number | null,
  domain: PlayerKitMetricDomain | null | undefined,
): string | undefined {
  if (value === null || !domain || !Number.isFinite(value)) return undefined;
  if (domain.min === domain.max) return rgb(scaleStops.midpoint);

  const lowerIsBetter = metricDirections[metric] === "lower";
  const lowColor = lowerIsBetter ? scaleStops.high : scaleStops.low;
  const highColor = lowerIsBetter ? scaleStops.low : scaleStops.high;

  if (value <= domain.average) {
    const denominator = domain.average - domain.min;
    if (denominator <= 0) return rgb(scaleStops.midpoint);
    return rgb(interpolateColor(lowColor, scaleStops.midpoint, (value - domain.min) / denominator));
  }

  const denominator = domain.max - domain.average;
  if (denominator <= 0) return rgb(scaleStops.midpoint);
  return rgb(interpolateColor(scaleStops.midpoint, highColor, (value - domain.average) / denominator));
}

export function getPlayerKitMetricComparisonLabel(
  metric: PlayerKitComparisonMetric,
  value: number | null,
  domain: PlayerKitMetricDomain | null | undefined,
): string | null {
  if (value === null || !domain || !Number.isFinite(value)) return null;
  if (domain.min === domain.max || Math.abs(value - domain.average) < 1e-9) {
    return "Dans la moyenne des kits joués";
  }

  const rawAboveAverage = value > domain.average;
  const betterThanAverage = metricDirections[metric] === "lower"
    ? !rawAboveAverage
    : rawAboveAverage;
  return betterThanAverage
    ? "Meilleur que la moyenne des kits joués"
    : "Moins bon que la moyenne des kits joués";
}

function buildDomain(values: number[]): PlayerKitMetricDomain | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Math.min(...values),
    average: total / values.length,
    max: Math.max(...values),
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
