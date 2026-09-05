"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RefreshCw, Sparkles } from "lucide-react";
import { categories, categoryLabels, type CosmeticView, type Selection } from "@/cosmetics/model";

export function CosmeticWardrobe({ initialView }: { initialView: CosmeticView }) {
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const inFlight = useRef(false);
  const request = useCallback(async (selection?: Selection, silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    if (!silent) setFeedback(null);
    try {
      const response = await fetch("/api/me/cosmetics", selection ? {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection),
        signal: AbortSignal.timeout(20_000),
      } : { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const result = await response.json();
      if (result.view) setView(result.view);
      else if (!response.ok) setView((old) => ({ ...old, status: "unavailable" }));
      if (response.status === 401) {
        setFeedback({ text: "Votre session a expiré. Reconnectez-vous avec Discord.", error: true });
        setView((old) => ({ ...old, status: "unavailable" }));
      } else if (!silent && result.message) {
        setFeedback({ text: result.message, error: !result.confirmed });
      } else if (!response.ok && !result.view) {
        throw new Error("Cosmetic request failed");
      }
    } catch {
      setView((old) => ({ ...old, status: "unavailable" }));
      if (!silent) setFeedback({
        text: selection
          ? "La modification n’a pas pu être confirmée. Actualisez l’équipement avant de réessayer."
          : "Le serveur ne répond pas. L’équipement affiché est la dernière observation disponible.",
        error: true,
      });
    } finally { inFlight.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void request(undefined, true); };
    const interval = setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, [request]);
  const canChange = view.status === "live" && !busy;
  const stamp = view.observedAt ? new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Paris",
  }).format(view.observedAt) : null;

  return (
    <section className="private-content-card cosmetic-wardrobe" id="cosmetiques" aria-labelledby="cosmetic-heading">
      <div className="cosmetic-heading">
        <div><p className="eyebrow">Votre collection</p><h2 id="cosmetic-heading">Cosmétiques</h2></div>
        <button type="button" className="button ghost compact-button" disabled={busy} onClick={() => void request()}>
          <RefreshCw size={15} aria-hidden="true" /> Actualiser
        </button>
      </div>
      <p>Retrouvez vos récompenses débloquées en jeu et choisissez votre équipement.</p>
      <div className={view.status === "live" ? "cosmetic-status is-live" : "cosmetic-status"}>
        <strong>{view.status === "live" ? "Équipement vérifié dans Minecraft" : view.status === "offline"
          ? "Joueur hors ligne" : view.status === "link_mismatch" ? "Liaison DiscordSRV à resynchroniser" : "Serveur indisponible"}</strong>
        <span>{view.status === "live" ? "Les changements sont appliqués directement à votre joueur connecté."
          : view.status === "link_mismatch" ? "Demandez une resynchronisation des comptes avant de modifier vos cosmétiques."
          : view.status === "offline" ? "Connectez-vous au serveur, puis actualisez pour changer votre équipement."
          : "Actualisez lorsque la connexion au serveur est rétablie pour gérer votre équipement."}</span>
        {stamp && <small>Dernière observation : {stamp} (heure de Paris){view.status !== "live" ? " — peut avoir changé depuis." : "."}</small>}
      </div>
      {feedback && <p className={feedback.error ? "cosmetic-feedback is-error" : "cosmetic-feedback"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      {view.issues.length > 0 && <p className="cosmetic-feedback is-error" role="status">Une incohérence a été détectée dans votre équipement Minecraft. Les sélections connues sont affichées ; les cosmétiques inconnus nécessitent une vérification par un administrateur.</p>}
      {view.observedAt === null ? (
        <p className="cosmetic-empty">Aucune observation Minecraft disponible. Connectez-vous au serveur, puis actualisez cette page pour découvrir votre collection.</p>
      ) : categories.map((category) => {
        const equipped = view.equipment[category];
        const entries = view.cosmetics.filter((c) => c.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section className="cosmetic-category" key={category} aria-labelledby={`category-${category}`}>
            <div className="cosmetic-category-heading">
              <div>
                <h3 id={`category-${category}`}>{categoryLabels[category]}</h3>
                <p>Équipé : <strong>{equipped?.name ?? "Aucun"}</strong></p>
              </div>
              <button type="button" className="button ghost compact-button"
                disabled={!canChange || (!equipped && !view.issues.includes("multiple:" + category))}
                onClick={() => void request({ category, cosmeticId: null })}>Déséquiper</button>
            </div>
            {category === "particle" && view.equipment.particle && !view.equipment.intensity && (
              <p className="cosmetic-hint">Choisissez aussi une intensité pour rendre vos particules visibles.</p>
            )}
            {entries.length === 0 ? <p className="cosmetic-empty">Aucun cosmétique débloqué dans cette catégorie.</p> : (
              <ul className="cosmetic-grid">
                {entries.map((cosmetic) => {
                  const selected = cosmetic.id === equipped?.id;
                  return <li key={cosmetic.id} className={selected ? "cosmetic-tile is-equipped" : "cosmetic-tile"}>
                    <Sparkles size={22} aria-hidden="true" />
                    <strong>{cosmetic.name}</strong>
                    <button type="button" className={selected ? "button ghost" : "button primary"}
                      disabled={!canChange || selected}
                      aria-label={selected ? `${cosmetic.name} équipé` : `Équiper ${cosmetic.name} — ${categoryLabels[category]}`}
                      onClick={() => void request({ category, cosmeticId: cosmetic.id })}>
                      {selected ? <><Check size={15} aria-hidden="true" /> Équipé</> : "Équiper"}
                    </button>
                  </li>;
                })}
              </ul>
            )}
          </section>
        );
      })}
      <span className="sr-only" role="status">{busy ? "Vérification auprès de Minecraft en cours…" : ""}</span>
    </section>
  );
}
