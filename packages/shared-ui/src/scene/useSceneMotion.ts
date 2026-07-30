"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { GHIBLI_MODE_BY_THEME } from "../theme/themes-ghibli";
import { SCENE_BREAKPOINT_PX, type SceneArea, type SceneMode, type SceneVariant } from "./scenePools";
import { sceneMotionFor } from "./sceneMotion";

/**
 * Entscheidet, ob und welcher Hintergrundclip laufen darf.
 *
 * Viewport, Theme und Bewegungsvorliebe sind **externe** Zustände: sie leben in
 * `matchMedia` und in einem Attribut auf `<html>`, das die Theme-Engine an
 * React vorbei setzt. Genau dafür gibt es `useSyncExternalStore` — abonnieren
 * statt im Effekt hinterherzusetzen. Das erspart die Kaskade aus
 * Render → Effekt → setState → Render und hält den Server-Snapshot explizit.
 *
 * Der Server-Snapshot ist bewusst „Desktop, hell, keine Bewegung": der Server
 * kennt weder Viewport noch Theme noch Netz. Es gibt deshalb im ersten Frame
 * nie ein `<video>` — die gemalte Standbild-Bühne steht ohnehin schon, und das
 * Video legt sich später darüber, wenn es wirklich abspielbar ist. Kein
 * Hydration-Mismatch, kein Nachlade-Blitz.
 *
 * Abgeschaltet wird bei:
 *   - `prefers-reduced-motion: reduce`         → Poster, dauerhaft
 *   - `html[data-uwe-motion="off"]`            → Poster, dauerhaft (App-Schalter)
 *   - `navigator.connection.saveData`          → Poster, dauerhaft
 *   - `effectiveType` "slow-2g" | "2g"         → Poster, dauerhaft
 *   - Bühne außerhalb des Viewports            → pausiert
 *   - `document.visibilityState !== "visible"` → pausiert
 */

export interface SceneMotionState {
  /** Erst wenn true, wird überhaupt ein <video> gerendert. */
  active: boolean;
  mode: SceneMode;
  variant: SceneVariant;
  objectPosition: string;
  /** Video ist dekodiert und darf das Poster überblenden. */
  ready: boolean;
  /** Vom `<video>`-Element bei `canplay` aufzurufen. */
  markReady: () => void;
}

/** Beobachtet das Theme-Attribut, das die Engine auf `<html>` schreibt. */
function subscribeHtmlAttributes(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-uwe-theme", "data-uwe-motion"],
  });
  return () => observer.disconnect();
}

function subscribeMedia(query: string, onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readMode(): SceneMode {
  const theme = document.documentElement.getAttribute("data-uwe-theme");
  return GHIBLI_MODE_BY_THEME[theme as keyof typeof GHIBLI_MODE_BY_THEME] ?? "hell";
}

function readVariant(): SceneVariant {
  return window.matchMedia(`(min-width: ${SCENE_BREAKPOINT_PX}px)`).matches ? "desktop" : "mobil";
}

function readAllowed(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (document.documentElement.getAttribute("data-uwe-motion") === "off") return false;

  // `connection` ist nicht überall implementiert — fehlt sie, wird geladen.
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const connection = nav.connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

export function useSceneMotion(
  area: SceneArea,
  hostRef: React.RefObject<HTMLElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
): SceneMotionState {
  const mode = useSyncExternalStore(subscribeHtmlAttributes, readMode, () => "hell" as const);

  const subscribeVariant = useCallback(
    (onChange: () => void) => subscribeMedia(`(min-width: ${SCENE_BREAKPOINT_PX}px)`, onChange),
    [],
  );
  const variant = useSyncExternalStore(subscribeVariant, readVariant, () => "desktop" as const);

  // Bewegungsvorliebe und Theme-Attribut können beide „aus" bedeuten, deshalb
  // hängt dieser Wert an zwei Quellen.
  const subscribeAllowed = useCallback((onChange: () => void) => {
    const stopMedia = subscribeMedia("(prefers-reduced-motion: reduce)", onChange);
    const stopAttributes = subscribeHtmlAttributes(onChange);
    return () => {
      stopMedia();
      stopAttributes();
    };
  }, []);
  const allowed = useSyncExternalStore(subscribeAllowed, readAllowed, () => false);

  const [onScreen, setOnScreen] = useState(false);
  const [ready, setReady] = useState(false);

  // --- Nur laufen lassen, was man auch sieht ------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([observed]) => setOnScreen(Boolean(observed?.isIntersecting)),
      // Etwas Vorlauf, damit der Clip beim Scrollen nicht erst am Rand startet.
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);

  const shouldPlay = allowed && onScreen && sceneMotionFor(area, mode, variant).available;

  // --- Tab im Hintergrund: anhalten ---------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const apply = () => {
      if (shouldPlay && document.visibilityState === "visible") {
        // `play()` kann abgelehnt werden (Autoplay-Politik, Energiesparmodus).
        // Das ist kein Fehlerfall: das Poster bleibt stehen, die Seite
        // funktioniert. Deshalb geschluckt statt in die Konsole geworfen.
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [shouldPlay, videoRef]);

  // --- Beim Quellwechsel (Tag/Nacht, Desktop/Mobil) neu überblenden -------
  const sourceKey = `${area}-${mode}-${variant}`;
  const lastKey = useRef(sourceKey);
  useEffect(() => {
    const video = videoRef.current;
    if (lastKey.current !== sourceKey) {
      lastKey.current = sourceKey;
      setReady(false);
      // `load()` verwirft den alten Puffer — ohne das behält Safari den
      // vorherigen Clip und der Moduswechsel bliebe unsichtbar.
      video?.load();
      return;
    }
    // Aus dem HTTP-Cache kann der Clip schon dekodiert sein, bevor React den
    // `canplay`-Listener hängen konnte. Einmal aktiv nachfragen.
    if (video && video.readyState >= 3) setReady(true);
  }, [sourceKey, videoRef]);

  const markReady = useCallback(() => setReady(true), []);

  return {
    active: shouldPlay,
    mode,
    variant,
    objectPosition: sceneMotionFor(area, mode, variant).objectPosition,
    ready: ready && shouldPlay,
    markReady,
  };
}
