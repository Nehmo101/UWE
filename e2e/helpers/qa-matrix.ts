import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** The 13 theme presets to sweep (see packages/shared-ui/src/theme/themes.ts). */
export const QA_THEME_PRESETS = [
  "uwe-default",
  "uwe-dark-fantasy",
  "uwe-charcoal-desk",
  "uwe-night-observatory",
  "uwe-parchment-study",
  "uwe-parchment-os",
  "uwe-parchment-teal",
  "uwe-werkbank",
  "uwe-lesesaal",
  "uwe-nachtstudie",
  "uwe-phosphor-console",
  "terra",
  "hells",
] as const;

export type QaThemePreset = (typeof QA_THEME_PRESETS)[number];

/** Core routes per app (subset of docs/design/uwe-qa-urls.md). */
export const QA_STUDIO_ROUTES = [
  { id: "today", path: "/today" },
  { id: "world-dashboard", path: "/worlds/terra/dashboard" },
  { id: "wiki-page", path: "/worlds/terra/lore/amans-geheimnis" },
  { id: "capture", path: "/capture" },
  { id: "search", path: "/search" },
  { id: "settings", path: "/settings" },
] as const;

export const QA_PORTAL_ROUTES = [
  { id: "discover", path: "/worlds" },
  { id: "world-home", path: "/worlds/terra" },
] as const;

const ARTIFACT_DIR = path.resolve(process.cwd(), process.env.QA_ARTIFACT_DIR ?? "qa-artifacts");
const DEFECTS_PATH = path.join(ARTIFACT_DIR, "defects.json");

export interface QaDefect {
  scope: "studio" | "portal";
  route: string;
  preset: string;
  rule: string;
  impact: string | null | undefined;
  nodes: string[];
}

export function ensureArtifactDir(): string {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  return ARTIFACT_DIR;
}

/**
 * Forces a theme preset by seeding the per-scope theme-preferences localStorage
 * key before any app script runs. Call before the first navigation.
 */
export async function forceThemePreset(
  page: Page,
  scope: "studio" | "portal",
  preset: QaThemePreset,
): Promise<void> {
  const storageKey = `uwe-theme-preferences-${scope}`;
  await page.addInitScript(
    ([key, themeId]) => {
      try {
        const raw = window.localStorage.getItem(key);
        const prefs = raw ? JSON.parse(raw) : {};
        prefs.themeId = themeId;
        window.localStorage.setItem(key, JSON.stringify(prefs));
      } catch {
        /* storage unavailable — ignore */
      }
    },
    [storageKey, preset] as const,
  );
}

/** Runs an axe color-contrast scan and returns any contrast defects. */
export async function scanContrast(
  page: Page,
  scope: "studio" | "portal",
  route: string,
  preset: string,
): Promise<QaDefect[]> {
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  return results.violations.map((violation) => ({
    scope,
    route,
    preset,
    rule: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.html).slice(0, 5),
  }));
}

/** Appends defects to the shared defects.json (serial e2e execution). */
export function recordDefects(defects: QaDefect[]): void {
  ensureArtifactDir();
  let existing: QaDefect[] = [];
  if (fs.existsSync(DEFECTS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(DEFECTS_PATH, "utf8")) as QaDefect[];
    } catch {
      existing = [];
    }
  }
  existing.push(...defects);
  fs.writeFileSync(DEFECTS_PATH, `${JSON.stringify(existing, null, 2)}\n`);
}

export function screenshotPath(scope: string, route: string, preset: string): string {
  ensureArtifactDir();
  return path.join(ARTIFACT_DIR, `${scope}__${route}__${preset}.png`);
}
