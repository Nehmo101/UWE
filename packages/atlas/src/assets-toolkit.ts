/**
 * Painting toolkit shared by the gouache asset recipe modules
 * (`assets.ts`, `assets-batch4.ts`).
 *
 * Extracted verbatim from `assets.ts` so recipe batches can live in separate
 * modules within the file-size budget. Function bodies are browser-only (they
 * touch a `CanvasRenderingContext2D`), but the module has no DOM access at
 * import time and is safe to import in Node.
 */

export type Ctx = CanvasRenderingContext2D;
export type Rng = () => number;
export type PathFn = (ctx: Ctx) => void;

/**
 * A gouache recipe draws around origin (0,0) = base-centre; the object grows
 * upward (−y). `s` is the asset size in px, `lw` the ink/edge weight in px.
 */
export type Recipe = (ctx: Ctx, s: number, rng: Rng, lw: number) => void;

function hexRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function darken(h: string, f: number): string {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r * (1 - f))},${Math.round(g * (1 - f))},${Math.round(b * (1 - f))})`;
}
export function lighten(h: string, f: number): string {
  const [r, g, b] = hexRgb(h);
  return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number): void {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#2a1e0c";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function rectFn(x: number, y: number, w: number, h: number): PathFn {
  return (c) => {
    c.beginPath();
    c.rect(x, y, w, h);
  };
}
export function polyFn(pts: number[][]): PathFn {
  return (c) => {
    c.beginPath();
    c.moveTo(pts[0]![0]!, pts[0]![1]!);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i]![0]!, pts[i]![1]!);
    c.closePath();
  };
}
export function ellipseFn(cx: number, cy: number, rx: number, ry: number): PathFn {
  return (c) => {
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };
}
export function blobFn(pts: number[][]): PathFn {
  return (c) => {
    const n = pts.length;
    c.beginPath();
    c.moveTo((pts[0]![0]! + pts[n - 1]![0]!) / 2, (pts[0]![1]! + pts[n - 1]![1]!) / 2);
    for (let i = 0; i < n; i++) {
      const cur = pts[i]!;
      const nx = pts[(i + 1) % n]!;
      c.quadraticCurveTo(cur[0]!, cur[1]!, (cur[0]! + nx[0]!) / 2, (cur[1]! + nx[1]!) / 2);
    }
    c.closePath();
  };
}
export function iblob(cx: number, cy: number, rx: number, ry: number, rng: Rng, jag = 0.24, n = 12): number[][] {
  const p: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rng() - 0.5) * 2 * jag;
    p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return p;
}

/** Fill (opaque) + darker pigment edge; `lw` drives the edge/ink weight. */
export function paint(ctx: Ctx, pf: PathFn, fill: string, lw: number, edgeColor?: string): void {
  ctx.save();
  ctx.fillStyle = fill;
  pf(ctx);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = edgeColor ?? darken(fill, 0.42);
  ctx.lineWidth = Math.max(0.5, lw);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  pf(ctx);
  ctx.stroke();
  ctx.restore();
}
