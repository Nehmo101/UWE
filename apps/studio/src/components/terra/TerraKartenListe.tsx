"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  benenneTerraKarteAction,
  erstelleTerraKarteAction,
  gibTerraKarteFreiAction,
  loescheTerraKarteAction,
  setzeTerraKarteSperreAction,
  weiseTerraKarteZurueckAction,
} from "@/app/terra-actions";

/**
 * Übersicht der Terra-Karten einer Welt.
 *
 * Bewusst OHNE Lazy-Bootstrap: der Vorgänger legte beim bloßen Aufruf seiner
 * Indexseite eine Welt in der Datenbank an — deshalb standen dort Zeilen, die
 * nie jemand gebaut hatte. Hier passiert auf einem GET nichts; angelegt wird
 * nur auf Klick.
 *
 * Seit J5 kommen Karten aus zwei Richtungen: der Spielleiter legt sie hier an,
 * Spieler bauen sie im Portal. Die Liste zeigt beides, nach Zustand getrennt,
 * und die Abnahme steht ganz oben — sie ist das, was auf jemanden wartet.
 */

export type TerraKartenListeStatus = "entwurf" | "eingereicht" | "freigegeben";

export interface TerraKartenListeEintrag {
  id: string;
  titel: string;
  version: number;
  updatedAt: string;
  status: TerraKartenListeStatus;
  /** `null` = im Studio entstanden. */
  autorName: string | null;
  eingereichtAm: string | null;
  /** Gesperrt = im Portal nur noch lesbar, auch fuer den Autor. */
  gesperrt: boolean;
}

export interface TerraKartenListeProps {
  worldSlug: string;
  karten: TerraKartenListeEintrag[];
}

export function TerraKartenListe({ worldSlug, karten }: TerraKartenListeProps) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  /** Ein Formular-Aufruf, ein Auffrischen, ein Fehlertext — überall gleich. */
  function fuehreAus(
    aktion: (form: FormData) => Promise<{ ok: boolean; error?: string }>,
    felder: Record<string, string>,
    ersatzFehler: string,
  ) {
    setFehler(null);
    starte(async () => {
      const form = new FormData();
      form.set("worldSlug", worldSlug);
      for (const [name, wert] of Object.entries(felder)) form.set(name, wert);
      const antwort = await aktion(form);
      if (antwort.ok) router.refresh();
      else setFehler(antwort.error ?? ersatzFehler);
    });
  }

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
    fuehreAus(benenneTerraKarteAction, { karteId, titel: geputzt }, "Umbenennen fehlgeschlagen");
  }

  function loeschen(karteId: string, titel: string) {
    if (!window.confirm(`Karte „${titel}" endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
    fuehreAus(loescheTerraKarteAction, { karteId }, "Löschen fehlgeschlagen");
  }

  function freigeben(karteId: string) {
    fuehreAus(gibTerraKarteFreiAction, { karteId }, "Freigeben fehlgeschlagen");
  }

  function sperren(karteId: string, gesperrt: boolean) {
    fuehreAus(
      setzeTerraKarteSperreAction,
      { karteId, gesperrt: String(gesperrt) },
      gesperrt ? "Sperren fehlgeschlagen" : "Entsperren fehlgeschlagen",
    );
  }

  function zurueckgeben(karteId: string, titel: string) {
    const rueckmeldung = window.prompt(`Was soll an „${titel}" noch geändert werden?`, "");
    if (rueckmeldung === null) return;
    fuehreAus(
      weiseTerraKarteZurueckAction,
      { karteId, rueckmeldung: rueckmeldung.trim() },
      "Zurückgeben fehlgeschlagen",
    );
  }

  const zurAbnahme = karten.filter((karte) => karte.status === "eingereicht");
  const spielerEntwuerfe = karten.filter((karte) => karte.status === "entwurf");
  const weltkarten = karten.filter((karte) => karte.status === "freigegeben");

  function zeile(karte: TerraKartenListeEintrag) {
    return (
      <li
        key={karte.id}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 hover:bg-muted/50"
      >
        <Link href={`/worlds/${worldSlug}/karten/${karte.id}`} className="min-w-0 flex-1 text-sm font-medium">
          {karte.titel}
        </Link>
        <span className="text-xs text-muted-foreground">
          {karte.autorName ? `von ${karte.autorName} · ` : ""}
          Fassung {karte.version} · {karte.eingereichtAm ?? karte.updatedAt}
        </span>
        {/*
          Der Sperren-Haken. Er hat nichts mit der Abnahme zu tun und steht
          deshalb daneben, nicht dahinter: gesperrt wird eine Karte, die am
          Tisch gilt — im Entwurf ebenso wie nach der Abnahme.
        */}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={karte.gesperrt}
            disabled={laeuft}
            onChange={(event) => sperren(karte.id, event.currentTarget.checked)}
            data-testid="terra-karte-sperren"
          />
          Sperren
        </label>
        {karte.status !== "freigegeben" ? (
          <button
            type="button"
            onClick={() => freigeben(karte.id)}
            disabled={laeuft}
            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            data-testid="terra-karte-freigeben"
          >
            Abnehmen
          </button>
        ) : null}
        {karte.status !== "freigegeben" && karte.autorName ? (
          <button
            type="button"
            onClick={() => zurueckgeben(karte.id, karte.titel)}
            disabled={laeuft}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
            data-testid="terra-karte-zurueckgeben"
          >
            Zurückgeben
          </button>
        ) : null}
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
    );
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

      {zurAbnahme.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Zur Abnahme ({zurAbnahme.length})</h2>
          <p className="text-xs text-muted-foreground">
            Karten, die deine Spieler im Portal gebaut und eingereicht haben.
          </p>
          <ul className="space-y-1" data-testid="terra-karten-abnahme">{zurAbnahme.map(zeile)}</ul>
        </section>
      ) : null}

      {spielerEntwuerfe.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Entwürfe der Spieler ({spielerEntwuerfe.length})</h2>
          <p className="text-xs text-muted-foreground">
            Noch in Arbeit — sichtbar, damit du mitliest, aber noch nicht eingereicht.
          </p>
          <ul className="space-y-1" data-testid="terra-karten-entwuerfe">{spielerEntwuerfe.map(zeile)}</ul>
        </section>
      ) : null}

      {/* Der Leerzustand hängt an der GANZEN Liste, nicht am freigegebenen
          Teil: „es gibt noch keine Karte" wäre falsch, solange Entwürfe der
          Spieler darüber stehen. */}
      {karten.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="terra-karten-leer">
          Für diese Welt gibt es noch keine Karte.
        </p>
      ) : weltkarten.length > 0 ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">Karten der Welt ({weltkarten.length})</h2>
          <ul className="space-y-1" data-testid="terra-karten-liste">{weltkarten.map(zeile)}</ul>
        </section>
      ) : null}
    </div>
  );
}
