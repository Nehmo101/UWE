/**
 * Kartuschen (Roadmap W4 #23) — dekorative Titel-Rahmen für Export und
 * Live-Deko. Browser-only Canvas-2D-Zeichnung (kein DOM außer `ctx`),
 * deterministisch, ohne PRNG. Stile:
 *
 *  - "scroll": Schriftrolle mit eingerollten Enden
 *  - "banner": Wimpel/Band mit gekerbten Enden
 *  - "plain":  klassischer Doppellinien-Kasten
 */

type Ctx = CanvasRenderingContext2D;

export type CartoucheStyle = "scroll" | "banner" | "plain";

export const CARTOUCHE_STYLES: ReadonlyArray<{ key: CartoucheStyle; label: string }> = [
  { key: "scroll", label: "Schriftrolle" },
  { key: "banner", label: "Banner" },
  { key: "plain", label: "Doppellinien-Kasten" },
];

export interface CartoucheOptions {
  /** Centre of the cartouche in canvas pixels. */
  x: number;
  y: number;
  /** Total width/height in canvas pixels. */
  width: number;
  height: number;
  style: CartoucheStyle;
  title: string;
  ink: string;
  parchment: string;
  /** Accent colour for banner tails / scroll curls. Defaults to `ink`. */
  accent?: string;
  /** CSS font for the title, e.g. `"16px serif"`. */
  font: string;
}

/** Draws a decorative title cartouche centred at (x, y). No-op for empty titles. */
export function drawCartouche(ctx: Ctx, opts: CartoucheOptions): void {
  const title = (opts.title || "").trim();
  if (!title) return;
  const { x, y, width: w, height: h } = opts;
  const accent = opts.accent ?? opts.ink;
  const left = x - w / 2;
  const top = y - h / 2;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (opts.style === "banner") {
    // Ribbon body with notched tails poking out left/right.
    const tail = Math.min(h * 0.9, w * 0.12);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(left - tail, top + h * 0.2);
    ctx.lineTo(left, top + h * 0.2);
    ctx.lineTo(left, top + h * 0.8);
    ctx.lineTo(left - tail, top + h * 0.8);
    ctx.lineTo(left - tail * 0.45, y);
    ctx.closePath();
    ctx.moveTo(left + w + tail, top + h * 0.2);
    ctx.lineTo(left + w, top + h * 0.2);
    ctx.lineTo(left + w, top + h * 0.8);
    ctx.lineTo(left + w + tail, top + h * 0.8);
    ctx.lineTo(left + w + tail * 0.45, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.2, h * 0.045);
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.fill();
    ctx.stroke();
  } else if (opts.style === "scroll") {
    // Parchment sheet with curled ends.
    const curl = Math.min(h * 0.5, w * 0.07);
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.2, h * 0.045);
    ctx.beginPath();
    ctx.moveTo(left + curl, top);
    ctx.lineTo(left + w - curl, top);
    ctx.quadraticCurveTo(left + w, top, left + w, top + h / 2);
    ctx.quadraticCurveTo(left + w, top + h, left + w - curl, top + h);
    ctx.lineTo(left + curl, top + h);
    ctx.quadraticCurveTo(left, top + h, left, top + h / 2);
    ctx.quadraticCurveTo(left, top, left + curl, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Curls at both ends.
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, h * 0.035);
    for (const [cx, dir] of [[left + curl * 0.4, 1], [left + w - curl * 0.4, -1]] as const) {
      ctx.beginPath();
      ctx.arc(cx, y, curl * 0.55, Math.PI * 0.25 * dir, Math.PI * (2 - 0.25 * dir), dir < 0);
      ctx.stroke();
    }
  } else {
    // "plain": double-line box, matching the export frame idiom.
    ctx.fillStyle = opts.parchment;
    ctx.strokeStyle = opts.ink;
    ctx.lineWidth = Math.max(1.4, h * 0.05);
    ctx.beginPath();
    ctx.rect(left, top, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, h * 0.02);
    ctx.strokeRect(left + h * 0.12, top + h * 0.12, w - h * 0.24, h - h * 0.24);
  }

  ctx.fillStyle = opts.ink;
  ctx.font = opts.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x, y);
  ctx.restore();
}
