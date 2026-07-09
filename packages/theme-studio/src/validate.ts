import { REQUIRED_PALETTE_KEYS, type PaletteColors } from "./palette-tokens";
import { AA_CONTRAST, contrastRatio, isHexColor } from "./contrast";

export type PaletteIssueKind = "missing" | "invalid" | "contrast";
export type PaletteIssueSeverity = "error" | "warning";

export interface PaletteIssue {
  kind: PaletteIssueKind;
  /** `error` blocks saving; `warning` is surfaced but non-blocking. */
  severity: PaletteIssueSeverity;
  /** The offending token key (or foreground key for contrast issues). */
  key?: string;
  message: string;
  /** Measured contrast ratio (contrast issues only). */
  ratio?: number;
}

export interface PaletteValidation {
  /** True when there are no `error`-severity issues (warnings are allowed). */
  ok: boolean;
  issues: PaletteIssue[];
}

/**
 * Foreground/background pairs checked for WCAG AA (4.5:1). `error` pairs are the
 * readability-critical ones the product itself guarantees (body text, links);
 * `warning` pairs are secondary signals (muted text, visibility markers, the
 * terracotta GM marker ships ~3.4:1 on parchment) — surfaced but non-blocking.
 * Skipped when either side is absent or a non-hex color (can't be measured).
 *
 * Note: primary-button text is auto-derived (black/white), whose best choice is
 * always ≥4.58:1 for any color, so there is no accent-button contrast gate.
 */
const CONTRAST_PAIRS: {
  fg: string;
  bg: string;
  label: string;
  severity: PaletteIssueSeverity;
}[] = [
  { fg: "fg", bg: "bg", label: "Text auf Hintergrund", severity: "error" },
  { fg: "link", bg: "bg", label: "Link auf Hintergrund", severity: "error" },
  { fg: "wikiLink", bg: "bg", label: "Wiki-Link auf Hintergrund", severity: "error" },
  { fg: "fgMuted", bg: "bg", label: "gedämpfter Text auf Hintergrund", severity: "warning" },
  { fg: "playerVisible", bg: "bg", label: "„Portal sichtbar“ auf Hintergrund", severity: "warning" },
  { fg: "dmOnly", bg: "bg", label: "„Nur GM“ auf Hintergrund", severity: "warning" },
  { fg: "sidebarFg", bg: "sidebarBg", label: "Sidebar-Text auf Sidebar", severity: "warning" },
];

/**
 * Validate a palette: completeness (all required keys → error), value validity
 * (malformed hex → error) and WCAG-AA contrast (severity per pair above).
 * `ok` is true when no `error`-severity issue remains.
 */
export function validatePalette(colors: PaletteColors): PaletteValidation {
  const issues: PaletteIssue[] = [];

  for (const key of REQUIRED_PALETTE_KEYS) {
    const value = colors[key];
    if (typeof value !== "string" || !value.trim()) {
      issues.push({ kind: "missing", severity: "error", key, message: `Farbe „${key}“ fehlt.` });
    }
  }

  // Validate hex where a hex value is expected (skip clearly non-hex tokens like
  // *Muted / gradient / surface which legitimately use rgba()).
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const looksHex = value.trim().startsWith("#");
    if (looksHex && !isHexColor(value)) {
      issues.push({
        kind: "invalid",
        severity: "error",
        key,
        message: `Farbe „${key}“ ist kein gültiger Hex-Wert: ${value}`,
      });
    }
  }

  for (const pair of CONTRAST_PAIRS) {
    const fg = colors[pair.fg];
    const bg = colors[pair.bg];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;
    if (ratio < AA_CONTRAST) {
      issues.push({
        kind: "contrast",
        severity: pair.severity,
        key: pair.fg,
        ratio,
        message: `Kontrast ${pair.label} zu gering: ${ratio.toFixed(2)}:1 (Ziel ≥ ${AA_CONTRAST}:1).`,
      });
    }
  }

  const ok = !issues.some((issue) => issue.severity === "error");
  return { ok, issues };
}

/**
 * A compact German instruction for the LLM to repair the palette. Returns an
 * empty string when the palette is valid (no blocking errors). Warnings are
 * appended as optional nudges so the model can improve them without blocking.
 */
export function buildRepairHint(validation: PaletteValidation): string {
  if (validation.ok) return "";
  const missing = validation.issues
    .filter((i) => i.kind === "missing")
    .map((i) => i.key);
  const invalid = validation.issues.filter((i) => i.kind === "invalid");
  const errorContrast = validation.issues.filter(
    (i) => i.kind === "contrast" && i.severity === "error",
  );
  const warnings = validation.issues.filter((i) => i.severity === "warning");

  const parts: string[] = ["Die Palette ist noch nicht gültig — bitte korrigiere:"];
  if (missing.length) parts.push(`Fehlende Farben: ${missing.join(", ")}.`);
  if (invalid.length) parts.push(`Ungültige Werte: ${invalid.map((i) => i.key).join(", ")}.`);
  for (const issue of errorContrast) parts.push(issue.message);
  if (warnings.length) {
    parts.push(`Optional verbessern: ${warnings.map((w) => w.message).join(" ")}`);
  }
  parts.push("Gib erneut NUR das vollständige JSON-Objekt der Palette zurück.");
  return parts.join(" ");
}
