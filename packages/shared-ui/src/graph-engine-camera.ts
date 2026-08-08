// Kamera-Tweening der Nachbarschafts-Graph-Engine (Fit / Pan-to-Selected).
//
// Bewusst eine eigene, GraphEngine-unabhängige Datei: reine State-Maschine,
// die nur interpolierte {tx, ty, zoom}-Werte liefert. Der Aufrufer
// (`graph-engine.ts`) wendet sie auf sein eigenes Kamera-State an. Das hält
// Kamera-Änderungen isoliert von paralleler Arbeit an Physik/Rendering im
// selben Modul (Modul-Disziplin: Monolith nicht anbauen).

export interface CameraState {
  tx: number;
  ty: number;
  zoom: number;
}

/**
 * Round 11: near-instant Fit/Pan (~180ms; was 250ms in R9/10, 420ms earlier).
 * Obsidian-like band is ~150–200ms; parchment still keeps a short ease (not a
 * hard cut) so select framing and DETAIL_PANEL_OFFSET_X remain readable.
 * prefers-reduced-motion stays instant. Wheel coast is cancelled on select/fit
 * so coast never fights the camera tween.
 */
export const CAMERA_TWEEN_MS = 180;

/** `prefers-reduced-motion: reduce` — lange Kamera-Tweens überspringen. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** easeOutQuint — reaches near-target faster than cubic; snappier settle. */
export function easeOutQuint(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p * p * p;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Zeitbasiertes Tween zwischen zwei Kamera-Zuständen (Pan + Zoom gemeinsam). */
export class CameraAnimator {
  private from: CameraState | null = null;
  private to: CameraState | null = null;
  private startTime = 0;
  private duration = CAMERA_TWEEN_MS;

  start(from: CameraState, to: CameraState, durationMs = CAMERA_TWEEN_MS): void {
    // Ziel effektiv unverändert (z. B. Fit ohne Layout-Änderung) → kein Tween nötig.
    if (from.tx === to.tx && from.ty === to.ty && from.zoom === to.zoom) {
      this.cancel();
      return;
    }
    this.from = { ...from };
    this.to = { ...to };
    this.duration = Math.max(1, durationMs);
    this.startTime = now();
  }

  cancel(): void {
    this.from = null;
    this.to = null;
  }

  isAnimating(): boolean {
    return this.from !== null && this.to !== null;
  }

  /** Nächsten Kamera-Zustand berechnen; beendet das Tween automatisch am Ziel. */
  step(): CameraState | null {
    if (!this.from || !this.to) return null;
    const elapsed = now() - this.startTime;
    const t = Math.min(1, elapsed / this.duration);
    const eased = easeOutQuint(t);
    const state: CameraState = {
      tx: this.from.tx + (this.to.tx - this.from.tx) * eased,
      ty: this.from.ty + (this.to.ty - this.from.ty) * eased,
      zoom: this.from.zoom + (this.to.zoom - this.from.zoom) * eased,
    };
    if (t >= 1) {
      this.from = null;
      this.to = null;
    }
    return state;
  }
}
