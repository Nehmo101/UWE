"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative animated white "Ranken" (vines) painted on the parchment behind
 * the landing content. Procedurally grown on a full-bleed <canvas>; purely
 * ornamental (`aria-hidden`, `pointer-events: none`).
 *
 * Ported 1:1 from the design reference (`Landing Page.dc.html` → setupCanvas).
 * Tunables and the growth/curl/leaf/branch algorithm follow
 * design_handoff_landing_page/README.md § "Background animation".
 *
 * Under `prefers-reduced-motion` a single fully-grown frame is rendered and no
 * animation loop starts. On mount the first frame is pre-simulated so the
 * canvas is never blank (rAF is paused while the tab is backgrounded).
 */
export function VineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SPACING = 6; // px between stored path points
    const MAX_BASE = 7; // concurrent root vines
    const MAX_VINES = 22; // hard cap incl. branches

    let W = 0;
    let H = 0;
    let vines: Vine[] = [];
    let spawnTimer = 0;
    let spawnEdge = 0;
    let raf = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    interface Leaf {
      x: number;
      y: number;
      ang: number;
      side: number;
      size: number;
    }
    interface Point {
      x: number;
      y: number;
      ang: number;
    }
    interface Vine {
      hx: number;
      hy: number;
      angle: number;
      pts: Point[];
      depth: number;
      grown: number;
      maxLen: number;
      speed: number;
      width: number;
      phase: number;
      freq: number;
      amp: number;
      spin: number;
      acc: number;
      age: number;
      state: "grow" | "hold" | "fade";
      hold: number;
      holdMax: number;
      fade: number;
      fadeMax: number;
      branchesLeft: number;
      leafSide: number;
      leaves: Leaf[];
      dead?: boolean;
    }

    const makeVine = (x: number, y: number, angle: number, depth: number): Vine => ({
      hx: x,
      hy: y,
      angle,
      pts: [{ x, y, ang: angle }],
      depth,
      grown: 0,
      maxLen: depth === 0 ? rand(320, 620) : rand(120, 260),
      speed: rand(55, 95),
      width: depth === 0 ? rand(2.2, 3.4) : rand(1.1, 1.9),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.6, 1.3),
      amp: rand(0.05, 0.11),
      spin: Math.random() < 0.5 ? 1 : -1,
      acc: 0,
      age: 0,
      state: "grow",
      hold: 0,
      holdMax: rand(2.5, 5),
      fade: 0,
      fadeMax: rand(2.5, 4),
      branchesLeft: depth === 0 ? 2 : 0,
      leafSide: 1,
      leaves: [],
    });

    const spawnBase = () => {
      if (vines.filter((v) => v.depth === 0).length >= MAX_BASE) return;
      let x: number;
      let y: number;
      let a: number;
      if (Math.random() < 0.45) {
        // interior origin — lets ranken wind through the middle, not only the edges
        x = rand(W * 0.18, W * 0.82);
        y = rand(H * 0.16, H * 0.84);
        a = rand(0, Math.PI * 2);
      } else {
        const edge = spawnEdge;
        spawnEdge = (spawnEdge + 1) % 4; // cycle edges for even coverage
        if (edge === 0) {
          x = rand(0, W);
          y = -10;
          a = rand(Math.PI * 0.25, Math.PI * 0.75);
        } else if (edge === 1) {
          x = W + 10;
          y = rand(0, H);
          a = rand(Math.PI * 0.75, Math.PI * 1.25);
        } else if (edge === 2) {
          x = rand(0, W);
          y = H + 10;
          a = rand(-Math.PI * 0.75, -Math.PI * 0.25);
        } else {
          x = -10;
          y = rand(0, H);
          a = rand(-Math.PI * 0.25, Math.PI * 0.25);
        }
      }
      vines.push(makeVine(x, y, a, 0));
    };

    const step = (v: Vine, dt: number) => {
      v.age += dt;
      const k = Math.min(2.2, dt * 60);
      if (v.state === "grow") {
        const t = Math.min(1, v.grown / v.maxLen);
        const tip = Math.pow(t, 3) * 0.14; // tighten into a tendril curl near the tip
        v.angle += (Math.sin(v.age * v.freq + v.phase) * v.amp + tip * v.spin) * k;
        const d = v.speed * dt;
        v.hx += Math.cos(v.angle) * d;
        v.hy += Math.sin(v.angle) * d;
        v.grown += d;
        v.acc += d;
        if (v.acc >= SPACING) {
          v.acc -= SPACING;
          v.pts.push({ x: v.hx, y: v.hy, ang: v.angle });
          if (v.pts.length % 3 === 0 && v.grown > 40) {
            v.leaves.push({
              x: v.hx,
              y: v.hy,
              ang: v.angle,
              side: v.leafSide,
              size: rand(4, 8),
            });
            v.leafSide *= -1;
          }
          if (v.branchesLeft > 0 && vines.length < MAX_VINES && t > 0.35 && Math.random() < 0.05) {
            v.branchesLeft--;
            const ba = v.angle + (Math.random() < 0.5 ? 1 : -1) * rand(0.5, 0.95);
            vines.push(makeVine(v.hx, v.hy, ba, v.depth + 1));
          }
        }
        if (v.grown >= v.maxLen) v.state = "hold";
      } else if (v.state === "hold") {
        v.hold += dt;
        if (v.hold >= v.holdMax) v.state = "fade";
      } else {
        v.fade += dt;
        if (v.fade >= v.fadeMax) v.dead = true;
      }
    };

    const drawVine = (v: Vine) => {
      if (v.pts.length < 2) return;
      const inA = Math.min(1, v.age / 0.7);
      const outA = v.state === "fade" ? Math.max(0, 1 - v.fade / v.fadeMax) : 1;
      const a = inA * outA;
      if (a <= 0.01) return;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(v.pts[0].x, v.pts[0].y);
        for (let i = 1; i < v.pts.length - 1; i++) {
          const mx = (v.pts[i].x + v.pts[i + 1].x) / 2;
          const my = (v.pts[i].y + v.pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(v.pts[i].x, v.pts[i].y, mx, my);
        }
        const last = v.pts[v.pts.length - 1];
        ctx.lineTo(last.x, last.y);
      };
      // 1) soft ink halo + outline so the white reads on cream parchment
      path();
      ctx.strokeStyle = "rgba(33,29,23," + 0.34 * outA + ")";
      ctx.lineWidth = v.width + 2.6;
      ctx.shadowColor = "rgba(33,29,23," + 0.3 * outA + ")";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 1.5;
      ctx.stroke();
      // 2) the white vine on top
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      path();
      ctx.strokeStyle = "rgba(255,255,255," + 0.95 * a + ")";
      ctx.lineWidth = v.width;
      ctx.stroke();
      // 3) leaves — white with a thin ink edge
      for (const lf of v.leaves) {
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.ang + lf.side * 0.95);
        ctx.beginPath();
        ctx.ellipse(lf.size * 0.9, 0, lf.size, lf.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255," + 0.92 * a + ")";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(33,29,23," + 0.3 * outA + ")";
        ctx.stroke();
        ctx.restore();
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      for (const v of vines) drawVine(v);
    };

    const resize = () => {
      W = el.clientWidth || window.innerWidth;
      H = el.clientHeight || window.innerHeight;
      el.width = Math.round(W * dpr);
      el.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    if (reduce) {
      for (let i = 0; i < MAX_BASE; i++) spawnBase();
      for (let n = 0; n < 900 && vines.some((v) => v.state === "grow"); n++) {
        for (const v of vines) step(v, 1 / 60);
      }
      render();
      return () => {
        window.removeEventListener("resize", onResize);
      };
    }

    // Seed a few vines and pre-grow them so the very first painted frame already
    // shows established ranken — the canvas is never blank, even before rAF runs.
    for (let i = 0; i < 5; i++) spawnBase();
    for (let i = 0; i < 150; i++) {
      if (i % 45 === 0) spawnBase();
      for (const v of vines) step(v, 1 / 60);
    }
    render();

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawnTimer += dt;
      if (spawnTimer > 1.6) {
        spawnTimer = 0;
        spawnBase();
      }
      for (const v of vines) step(v, dt);
      vines = vines.filter((v) => !v.dead);
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
