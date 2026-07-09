"use client";

import { useEffect, useRef } from "react";
import type { BackgroundPatternId } from "./tokens";
import { getTheme } from "./themes";

function readEffectColor(
  explicit: string | undefined,
  themeId: string,
): string {
  if (explicit) return explicit;
  const theme = getTheme(themeId);
  return theme.defaults?.bgEffectColor ?? theme.colors.accent;
}

/** Lightweight canvas overlays for animated backgrounds (independent implementation). */
export function BackgroundEffect({
  pattern,
  effectColor,
  intensity,
  themeId,
}: {
  pattern: BackgroundPatternId;
  effectColor?: string;
  intensity: number;
  themeId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = readEffectColor(effectColor, themeId);
  const alpha = Math.max(0, Math.min(1, intensity));

  useEffect(() => {
    if (pattern !== "synapse" && pattern !== "constellation") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; vx: number; vy: number; r: number }[] =
      [];
    let pulses: { x: number; y: number; dx: number; dy: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (pattern === "constellation" && stars.length === 0) {
        stars = Array.from({ length: 42 }, () => ({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: 0.6 + Math.random() * 1.1,
        }));
      }
    };

    const drawConstellation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h;
        if (s.y > h) s.y = 0;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i];
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            ctx.globalAlpha = (1 - dist / 110) * 0.12 * alpha;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = color;
      for (const s of stars) {
        ctx.globalAlpha = 0.18 * alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawSynapse = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const grid = 28;
      ctx.clearRect(0, 0, w, h);
      if (pulses.length < 14 && Math.random() < 0.1) {
        const horizontal = Math.random() > 0.5;
        const speed = 2 + Math.random() * 10;
        if (horizontal) {
          pulses.push({
            x: -8,
            y: Math.floor(Math.random() * (h / grid)) * grid,
            dx: speed,
            dy: 0,
          });
        } else {
          pulses.push({
            x: Math.floor(Math.random() * (w / grid)) * grid,
            y: -8,
            dx: 0,
            dy: speed,
          });
        }
      }
      ctx.strokeStyle = color;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.x += p.dx;
        p.y += p.dy;
        if (p.x > w + 12 || p.y > h + 12) {
          pulses.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 0.35 * alpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * 4, p.y - p.dy * 4);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 0.55 * alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (pattern === "constellation") drawConstellation();
      if (pattern === "synapse") drawSynapse();
      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      pulses = [];
      stars = [];
    };
  }, [pattern, color, alpha]);

  if (pattern !== "synapse" && pattern !== "constellation") {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="uwe-bg-canvas"
      aria-hidden="true"
    />
  );
}
