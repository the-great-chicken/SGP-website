import type { LeaderboardMetric, PublicEdition } from "@/db/historical-stats-query";
import { formatKitName } from "./kit-manifest";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const date = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const leaderboardMetricLabels: Record<LeaderboardMetric, string> = {
  elo: "Elo",
  kills: "Éliminations",
  damage: "Dégâts infligés",
  playtime: "Temps de jeu",
};

export function formatLeaderboardValue(metric: LeaderboardMetric, value: number) {
  if (metric === "elo") return decimal.format(value);
  if (metric === "damage") return compact.format(value);
  if (metric === "playtime") return formatPlaytime(value);
  return integer.format(value);
}

export function formatCount(value: number) {
  return integer.format(value);
}

export function formatDecimal(value: number) {
  return decimal.format(value);
}

export function formatPlaytime(ticks: number) {
  const totalMinutes = Math.round(ticks / 1_200);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes.toString().padStart(2, "0")}`;
}

export function formatEditionLabel(edition: Pick<PublicEdition, "number" | "name">) {
  return edition.name ?? `Édition ${edition.number}`;
}

export function formatEditionDate(value: Date | null) {
  return value ? date.format(value) : null;
}

export function formatFavoriteKit(key: string | null) {
  return key === null ? "—" : formatKitName(key);
}
