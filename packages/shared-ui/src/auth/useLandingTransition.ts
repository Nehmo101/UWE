"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Der Übergang von der Startseite in einen Bereich.
 *
 * Die Regel dahinter ist wichtiger als der Effekt: **die Navigation hängt an
 * einem Timer, nicht am Ende der Animation.** Ein `transitionend`-Listener wäre
 * die elegantere Lösung und die unzuverlässigere — er feuert nicht, wenn das
 * Element ausgeblendet ist, wenn der Tab im Hintergrund liegt, wenn der Browser
 * im Energiesparmodus Animationen überspringt oder wenn eine
 * `prefers-reduced-motion`-Regel den Übergang von vornherein entfernt. In all
 * diesen Fällen bliebe der Nutzer auf einer Seite stehen, die er verlassen
 * wollte. Der Timer läuft immer.
 *
 * Dauer: 620 ms mit Bewegung, 180 ms ohne. Beides liegt im Bereich, in dem sich
 * ein Wechsel noch direkt anfühlt.
 *
 * Der Übergang endet nicht von selbst: `data-leaving` bleibt gesetzt, damit der
 * Schleier über der Seite liegen bleibt, bis die Zielseite übernimmt — sonst
 * blitzt zwischen beiden Seiten der Hintergrund auf. Wer auf der Seite *bleibt*
 * (die Anmeldekarte wird im selben Baum eingeblendet), muss den Übergang darum
 * ausdrücklich mit `settle()` beenden. Ohne das bliebe der Schleier für immer
 * stehen und die Seite wirkte leer.
 */

const TRANSITION_MS = 620;
const REDUCED_MS = 180;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return document.documentElement.getAttribute("data-uwe-motion") === "off";
}

export interface LandingTransition<T extends string> {
  /** Welches Ziel läuft gerade an? `null`, solange nichts gewählt ist. */
  leavingTo: T | null;
  /** Startet den Übergang und ruft danach `run` auf. */
  start: (target: T, origin: { x: number; y: number }, run: () => void) => void;
  /**
   * Beendet den Übergang und nimmt den Schleier zurück. Aufzurufen, wenn die
   * Seite bestehen bleibt — nicht bei einer echten Navigation, dort deckt der
   * Schleier den Wechsel ab.
   */
  settle: () => void;
  /** Auf `.uwe-lp-root` zu setzen. */
  rootProps: {
    "data-leaving": "true" | "false";
    style: Record<string, string>;
  };
}

export function useLandingTransition<T extends string>(): LandingTransition<T> {
  const [leavingTo, setLeavingTo] = useState<T | null>(null);
  const [origin, setOrigin] = useState({ x: 50, y: 60 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ein laufender Timer, der nach dem Unmount feuert, würde auf einer bereits
  // verlassenen Seite navigieren.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const settle = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setLeavingTo(null);
  }, []);

  // Zurück aus der Ziel-App: der Browser stellt die Seite aus dem Cache genau so
  // wieder her, wie sie verlassen wurde — mit gesetztem `data-leaving` und damit
  // hinter dem Schleier. Ohne das hier wäre die Startseite nach jedem Zurück leer.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) settle();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [settle]);

  const start = useCallback((target: T, from: { x: number; y: number }, run: () => void) => {
    // Zweiter Klick während eines laufenden Übergangs: ignorieren. Sonst
    // konkurrieren zwei Timer um zwei verschiedene Ziele.
    if (timer.current) return;

    setOrigin(from);
    setLeavingTo(target);
    const wait = prefersReducedMotion() ? REDUCED_MS : TRANSITION_MS;
    timer.current = setTimeout(() => {
      // Erst freigeben, dann ausführen: sonst bliebe die Sperre oben für immer
      // stehen und kein zweiter Klick käme je wieder durch.
      timer.current = null;
      run();
    }, wait);
  }, []);

  return {
    leavingTo,
    start,
    settle,
    rootProps: {
      "data-leaving": leavingTo ? "true" : "false",
      style: {
        // Der Ursprung der Blende ist die Mitte der gewählten Karte — von dort
        // aus zieht die Szene, nicht aus der Bildmitte.
        "--uwe-lp-origin-x": `${origin.x}%`,
        "--uwe-lp-origin-y": `${origin.y}%`,
        // Die Bühne schiebt sich der Karte entgegen: liegt die Karte links,
        // wandert das Bild nach rechts. Gedämpft auf ±3 %, damit aus dem
        // Hineinziehen kein Schwenk wird.
        "--uwe-lp-pull-x": `${((50 - origin.x) / 50) * 3}%`,
        "--uwe-lp-pull-y": `${((50 - origin.y) / 50) * 2 - 2}%`,
      },
    },
  };
}

/** Mittelpunkt eines Elements in Prozent des Viewports. */
export function elementOrigin(element: HTMLElement | null): { x: number; y: number } {
  if (!element || typeof window === "undefined") return { x: 50, y: 60 };
  const box = element.getBoundingClientRect();
  return {
    x: ((box.left + box.width / 2) / window.innerWidth) * 100,
    y: ((box.top + box.height / 2) / window.innerHeight) * 100,
  };
}
