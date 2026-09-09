"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { KitCard } from "@/components/kit-card";
import type { KitCardView } from "@/lib/kit-manifest";
import { getKitMetricDomains, type KitStatsSnapshot } from "@/lib/kit-stats";

type KitBrowserProps = {
  kits: KitCardView[];
  stats: KitStatsSnapshot;
};

type SortOrder = "name" | "popularity";

export function KitBrowser({ kits, stats }: KitBrowserProps) {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name");
  const metricDomains = useMemo(() => getKitMetricDomains(kits, stats), [kits, stats]);
  const visibleKits = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return kits
      .filter((kit) => !normalizedQuery || kit.searchText.includes(normalizedQuery))
      .toSorted((a, b) => compareCards(a, b, sortOrder, stats));
  }, [kits, query, sortOrder, stats]);

  return (
    <section className="kit-browser" aria-label="Catalogue des kits">
      <div className="kit-browser-toolbar">
        <label className="kit-search">
          <Search size={18} />
          <span className="sr-only">Rechercher un kit, une capacité ou un objet</span>
          <input
            type="search"
            placeholder="Kit, capacité ou objet…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="kit-sort">
          <SlidersHorizontal size={16} />
          <span>Trier par</span>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
            <option value="name">Nom</option>
            <option value="popularity" disabled={stats.editionCount === 0}>
              Popularité
            </option>
          </select>
        </label>
      </div>

      <p className="kit-browser-count" aria-live="polite">
        {visibleKits.length} kit{visibleKits.length > 1 ? "s" : ""}
        {query ? " trouvé" : " disponible"}
        {visibleKits.length > 1 ? "s" : ""}
      </p>

      {visibleKits.length ? (
        <div className="kit-grid">
          {visibleKits.map((kit) => (
            <KitCard
              kit={kit}
              stats={stats.byKitKey[kit.key]}
              statsContext={stats}
              metricDomains={metricDomains}
              key={kit.key}
            />
          ))}
        </div>
      ) : (
        <div className="kit-browser-empty">
          <Search size={22} />
          <strong>Aucun kit ne correspond.</strong>
          <span>Essayez le nom d’un objet ou d’une capacité.</span>
        </div>
      )}
    </section>
  );
}

function compareCards(
  a: KitCardView,
  b: KitCardView,
  sortOrder: SortOrder,
  stats: KitStatsSnapshot,
) {
  if (sortOrder === "name") {
    return a.name.localeCompare(b.name, "fr-FR");
  }
  if (sortOrder === "popularity") {
    const difference = (stats.byKitKey[b.key]?.picks ?? 0) - (stats.byKitKey[a.key]?.picks ?? 0);
    if (difference) {
      return difference;
    }
  }
  if (a.id === null) {
    return b.id === null ? a.name.localeCompare(b.name, "fr-FR") : 1;
  }
  if (b.id === null) {
    return -1;
  }
  return a.id - b.id;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}
