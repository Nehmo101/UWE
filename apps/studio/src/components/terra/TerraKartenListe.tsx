"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { benenneTerraKarteAction, erstelleTerraKarteAction, loescheTerraKarteAction } from "@/app/terra-actions";

/**
 * Übersicht der Terra-Karten einer Welt.
 *
 * Bewusst OHNE Lazy-Bootstrap: der Vorgänger legte beim bloßen Aufruf seiner
 * Indexseite eine Welt in der Datenbank an — deshalb standen dort Zeilen, die
 * nie jemand gebaut hatte. Hier passiert auf einem GET nichts; angelegt wird
 * nur auf Klick.
 */

export interface TerraKartenListeProps {
  worldSlug: string;
  karten: Array<{ id: string; titel: string; version: number; updatedAt: string }>;
}

export function TerraKartenListe({ worldSlug, karten }: TerraKartenListeProps) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  function anlegen() {
    setFehler(null);
    starte(async () => {
      const form = new FormData();
      form.set("worldSlug", worldSlug);
      form.set("titel", "Neue Karte");
      const antwort = await erstelleTerraKarteAction(form);
      if (antwort.ok && antwort.karteId) {
        router.push(`/worlds/${worldSlug}/karten/${antwort.karteId}`);
      } else {
        setFehler(antwort.error ?? "Anlegen fehlgeschlagen");
      }
    });
  }

  function umbenennen(karteId: string, titel: string) {
    const neu = window.prompt("Neuer Name der Karte", titel);
    if (neu === null) return;
    const geputzt = neu.trim();
    if (!geputzt || geputzt === titel) return;
    setFehler(null);
    starte(async () => {
      const form = new FormData();
      form.set("worldSlug", worldSlug);
      form.set("karteId", karteId);
      form.set("titel", geputzt);
      const antwort = await benenneTerraKarteAction(form);
      if (antwort.ok) router.refresh();
      else setFehler(antwort.error ?? "Umbenennen fehlgeschlagen");
    });
  }

  function loeschen(karteId: string, titel: string) {
    if (!window.confirm(`Karte „${titel}" endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
    setFehler(null);
    starte(async () => {
      const form = new FormData();
      form.set("worldSlug", worldSlug);
      form.set("karteId", karteId);
      const antwort = await loescheTerraKarteAction(form);
      if (antwort.ok) router.refresh();
      else setFehler(antwort.error ?? "Löschen fehlgeschlagen");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={anlegen}
          disabled={laeuft}
          className="rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-primary disabled:opacity-60"
          data-testid="terra-karte-anlegen"
        >
          Neue Karte
        </button>
        {fehler ? <span className="text-sm text-destructive">{fehler}</span> : null}
      </div>

      {karten.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="terra-karten-leer">
          Für diese Welt gibt es noch keine Karte.
        </p>
      ) : (
        <ul className="space-y-1" data-testid="terra-karten-liste">
          {karten.map((karte) => (
            <li key={karte.id} className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 hover:bg-muted/50">
              <Link href={`/worlds/${worldSlug}/karten/${karte.id}`} className="min-w-0 flex-1 text-sm font-medium">
                {karte.titel}
              </Link>
              <span className="text-xs text-muted-foreground">
                Fassung {karte.version} · {karte.updatedAt}
              </span>
              <button
                type="button"
                onClick={() => umbenennen(karte.id, karte.titel)}
                disabled={laeuft}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                data-testid="terra-karte-umbenennen"
              >
                Umbenennen
              </button>
              <button
                type="button"
                onClick={() => loeschen(karte.id, karte.titel)}
                disabled={laeuft}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
