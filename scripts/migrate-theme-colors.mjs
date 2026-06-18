#!/usr/bin/env node
/**
 * One-shot migration: replace hardcoded UWE palette literals with CSS variables.
 * Run from repo root: node scripts/migrate-theme-colors.mjs <file.css>
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/migrate-theme-colors.mjs <file.css>");
  process.exit(1);
}

/** Longest-first replacements to avoid partial matches */
const REPLACEMENTS = [
  // Panel / card / border (exact rgba)
  ["rgba(15, 23, 42, 0.55)", "var(--uwe-card)"],
  ["rgba(15, 23, 42, 0.45)", "color-mix(in srgb, var(--uwe-card) 82%, transparent)"],
  ["rgba(15, 23, 42, 0.35)", "color-mix(in srgb, var(--uwe-card) 64%, transparent)"],
  ["rgba(15, 23, 42, 0.8)", "color-mix(in srgb, var(--uwe-card) 100%, var(--uwe-bg) 20%)"],
  ["rgba(8, 12, 22, 0.85)", "color-mix(in srgb, var(--uwe-panel) 100%, var(--uwe-bg) 30%)"],
  ["rgba(8, 12, 22, 0.8)", "color-mix(in srgb, var(--uwe-panel) 100%, var(--uwe-bg) 25%)"],
  ["rgba(8, 12, 22, 0.55)", "var(--uwe-panel)"],
  ["rgba(8, 12, 22, 0.5)", "color-mix(in srgb, var(--uwe-panel) 91%, transparent)"],
  ["rgba(148, 163, 184, 0.12)", "var(--uwe-border)"],
  ["rgba(148, 163, 184, 0.15)", "color-mix(in srgb, var(--uwe-border) 125%, var(--uwe-muted) 0%)"],
  ["rgba(148, 163, 184, 0.18)", "color-mix(in srgb, var(--uwe-border) 150%, var(--uwe-muted) 0%)"],
  ["rgba(148, 163, 184, 0.2)", "color-mix(in srgb, var(--uwe-border) 167%, var(--uwe-muted) 0%)"],
  ["rgba(148, 163, 184, 0.25)", "color-mix(in srgb, var(--uwe-border) 208%, var(--uwe-muted) 0%)"],
  ["rgba(148, 163, 184, 0.35)", "color-mix(in srgb, var(--uwe-border) 292%, var(--uwe-muted) 0%)"],
  // Semantic status backgrounds (keep relative to tokens)
  ["rgba(248, 113, 113, 0.35)", "color-mix(in srgb, var(--uwe-danger) 35%, transparent)"],
  ["rgba(248, 113, 113, 0.25)", "color-mix(in srgb, var(--uwe-danger) 25%, transparent)"],
  ["rgba(248, 113, 113, 0.15)", "color-mix(in srgb, var(--uwe-danger) 15%, transparent)"],
  ["rgba(248, 113, 113, 0.1)", "color-mix(in srgb, var(--uwe-danger) 10%, transparent)"],
  ["rgba(74, 222, 128, 0.12)", "color-mix(in srgb, var(--uwe-success) 12%, transparent)"],
  ["rgba(74, 222, 128, 0.2)", "color-mix(in srgb, var(--uwe-success) 20%, transparent)"],
  ["rgba(34, 197, 94, 0.12)", "color-mix(in srgb, var(--uwe-success) 12%, transparent)"],
  ["rgba(34, 197, 94, 0.25)", "color-mix(in srgb, var(--uwe-success) 25%, transparent)"],
  ["rgba(34, 197, 94, 0.35)", "color-mix(in srgb, var(--uwe-success) 35%, transparent)"],
  ["rgba(251, 191, 36, 0.12)", "color-mix(in srgb, var(--uwe-warning) 12%, transparent)"],
  ["rgba(56, 189, 248, 0.12)", "color-mix(in srgb, var(--uwe-info) 12%, transparent)"],
  ["rgba(56, 189, 248, 0.15)", "color-mix(in srgb, var(--uwe-info) 15%, transparent)"],
  ["rgba(99, 102, 241, 0.15)", "color-mix(in srgb, var(--uwe-accent) 15%, transparent)"],
  ["rgba(99, 102, 241, 0.18)", "color-mix(in srgb, var(--uwe-accent) 18%, transparent)"],
  ["rgba(99, 102, 241, 0.1)", "color-mix(in srgb, var(--uwe-accent) 10%, transparent)"],
  ["rgba(99, 102, 241, 0.12)", "color-mix(in srgb, var(--uwe-accent) 12%, transparent)"],
  ["rgba(99, 102, 241, 0.08)", "color-mix(in srgb, var(--uwe-accent) 8%, transparent)"],
  ["rgba(99, 102, 241, 0.5)", "color-mix(in srgb, var(--uwe-accent) 50%, transparent)"],
  ["rgba(129, 140, 248, 0.35)", "color-mix(in srgb, var(--uwe-accent) 35%, white 15%)"],
  ["rgba(129, 140, 248, 0.45)", "color-mix(in srgb, var(--uwe-accent) 45%, white 15%)"],
  ["rgba(129, 140, 248, 0.3)", "color-mix(in srgb, var(--uwe-accent) 30%, white 15%)"],
  ["rgba(129, 140, 248, 0.6)", "color-mix(in srgb, var(--uwe-accent) 60%, white 15%)"],
  ["rgba(129, 140, 248, 0.5)", "color-mix(in srgb, var(--uwe-accent) 50%, white 15%)"],
  // Hex foreground
  ["#f8fafc", "var(--uwe-fg)"],
  ["#f1f5f9", "var(--uwe-fg)"],
  ["#e2e8f0", "var(--uwe-fg)"],
  ["#cbd5e1", "var(--uwe-fg)"],
  ["#e0e7ff", "color-mix(in srgb, var(--uwe-accent) 25%, var(--uwe-fg) 75%)"],
  ["#c7d2fe", "color-mix(in srgb, var(--uwe-accent) 35%, var(--uwe-fg) 65%)"],
  ["#a5b4fc", "color-mix(in srgb, var(--uwe-accent) 55%, var(--uwe-fg) 45%)"],
  ["#94a3b8", "var(--uwe-muted)"],
  ["#64748b", "color-mix(in srgb, var(--uwe-muted) 78%, var(--uwe-bg) 22%)"],
  // Accent
  ["#818cf8", "color-mix(in srgb, var(--uwe-accent) 75%, white 25%)"],
  ["#6366f1", "var(--uwe-accent)"],
  ["#4f46e5", "color-mix(in srgb, var(--uwe-accent) 85%, black 15%)"],
  // Status
  ["#fca5a5", "var(--uwe-danger)"],
  ["#f87171", "color-mix(in srgb, var(--uwe-danger) 90%, white 10%)"],
  ["#fecaca", "color-mix(in srgb, var(--uwe-danger) 70%, white 30%)"],
  ["#fcd34d", "var(--uwe-warning)"],
  ["#fbbf24", "color-mix(in srgb, var(--uwe-warning) 90%, white 10%)"],
  ["#86efac", "var(--uwe-success)"],
  ["#bbf7d0", "color-mix(in srgb, var(--uwe-success) 70%, white 30%)"],
  ["#6ee7b7", "color-mix(in srgb, var(--uwe-success) 80%, white 20%)"],
  ["#7dd3fc", "var(--uwe-info)"],
  ["#38bdf8", "color-mix(in srgb, var(--uwe-info) 90%, white 10%)"],
  // Background gradient anchors
  ["#0b1220", "var(--uwe-bg)"],
  ["#060a12", "color-mix(in srgb, var(--uwe-bg) 70%, black 30%)"],
  ["#0f172a", "color-mix(in srgb, var(--uwe-bg) 90%, var(--uwe-fg) 10%)"],
  ["#1e293b", "color-mix(in srgb, var(--uwe-bg) 85%, var(--uwe-fg) 15%)"],
  ["#020617", "color-mix(in srgb, var(--uwe-bg) 50%, black 50%)"],
  // Portal purple palette (resolved via [data-app="portal"] tokens)
  ["#7c3aed", "var(--uwe-accent)"],
  ["#6d28d9", "color-mix(in srgb, var(--uwe-accent) 85%, black 15%)"],
  ["#a78bfa", "var(--uwe-muted)"],
  ["#c4b5fd", "var(--uwe-info)"],
  ["#ddd6fe", "color-mix(in srgb, var(--uwe-info) 80%, var(--uwe-fg) 20%)"],
  ["#f5f3ff", "var(--uwe-fg)"],
  ["#312e81", "color-mix(in srgb, var(--uwe-accent) 35%, var(--uwe-bg) 65%)"],
  ["#1e1b4b", "var(--uwe-bg)"],
  ["#0f0a2e", "color-mix(in srgb, var(--uwe-bg) 70%, black 30%)"],
  ["rgba(167, 139, 250, 0.15)", "var(--uwe-border)"],
  ["rgba(167, 139, 250, 0.2)", "color-mix(in srgb, var(--uwe-border) 133%, var(--uwe-muted) 0%)"],
  ["rgba(167, 139, 250, 0.25)", "color-mix(in srgb, var(--uwe-border) 167%, var(--uwe-muted) 0%)"],
  ["rgba(167, 139, 250, 0.35)", "color-mix(in srgb, var(--uwe-border) 233%, var(--uwe-muted) 0%)"],
  ["rgba(167, 139, 250, 0.45)", "color-mix(in srgb, var(--uwe-border) 300%, var(--uwe-muted) 0%)"],
  ["rgba(167, 139, 250, 0.65)", "color-mix(in srgb, var(--uwe-border) 433%, var(--uwe-muted) 0%)"],
  ["rgba(124, 58, 237, 0.2)", "color-mix(in srgb, var(--uwe-accent) 20%, transparent)"],
  ["rgba(15, 10, 46, 0.55)", "var(--uwe-panel)"],
  ["rgba(15, 10, 46, 0.8)", "color-mix(in srgb, var(--uwe-panel) 100%, var(--uwe-bg) 25%)"],
  ["rgba(15, 10, 46, 0.45)", "color-mix(in srgb, var(--uwe-panel) 82%, transparent)"],
  ["rgba(30, 27, 75, 0.75)", "color-mix(in srgb, var(--uwe-card) 100%, transparent 25%)"],
  ["rgba(30, 27, 75, 0.85)", "color-mix(in srgb, var(--uwe-card) 100%, var(--uwe-bg) 15%)"],
];

let content = readFileSync(file, "utf8");

// Skip token definition block (first 80 lines after we add it)
const tokenEndMarker = "/* === UWE component styles === */";
const tokenEnd = content.indexOf(tokenEndMarker);
const prefix = tokenEnd >= 0 ? content.slice(0, tokenEnd + tokenEndMarker.length) : "";
const body = tokenEnd >= 0 ? content.slice(tokenEnd + tokenEndMarker.length) : content;

let migrated = body;
let total = 0;
for (const [from, to] of REPLACEMENTS) {
  const parts = migrated.split(from);
  const count = parts.length - 1;
  if (count > 0) {
    total += count;
    migrated = parts.join(to);
  }
}

writeFileSync(file, prefix + migrated);
console.log(`Migrated ${total} replacements in ${file}`);
