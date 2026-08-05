/**
 * Gemeinsamer Teil des gezielten Verifikationslaufs (`pnpm verify:ui`).
 *
 * Anders als die Theme-Matrix hat dieser Lauf **keine feste Routenliste**: Die
 * Routen kommen als Argument herein, weil eine Verifikation immer eine konkrete
 * Frage beantwortet („zeigt das Cockpit die Kapitel?") und nicht einen Katalog
 * abarbeitet.
 *
 * Neben dem Bild entsteht ein Manifest. Das ist der Teil, der die Bilder
 * auswertbar macht: Ein leerer Zustand ist im Bild sofort zu sehen, im Manifest
 * aber auch ohne Hinsehen — Titel, HTTP-Status und die sichtbaren Überschriften
 * stehen als Text daneben.
 */

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export interface VerifyUiEntry {
  route: string;
  status: number | null;
  finalUrl: string;
  title: string;
  headings: string[];
  screenshot: string;
}

export function verifyUiRoutes(): string[] {
  return (process.env.VERIFY_UI_ROUTES ?? "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
}

export function verifyUiOutputDir(): string {
  return process.env.VERIFY_UI_OUT ?? "";
}

/** Dateiname aus einer Route: `/worlds/terra/kampagnen` → `worlds-terra-kampagnen`. */
export function routeFileName(route: string): string {
  const cleaned = route.replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "start";
}

/**
 * Ruft eine Route auf, schießt ein Vollbild und gibt den Manifest-Eintrag zurück.
 *
 * `networkidle` statt `load`: Studio lädt seine Inhalte über Server-Komponenten
 * nach; ein zu frühes Bild zeigt die Hülle und beweist nichts.
 */
export async function captureRoute(
  page: Page,
  scope: string,
  route: string,
  outputDir: string,
): Promise<VerifyUiEntry> {
  const response = await page.goto(route, { waitUntil: "networkidle" });
  const file = `${scope}-${routeFileName(route)}.png`;
  fs.mkdirSync(outputDir, { recursive: true });
  await page.screenshot({ path: path.join(outputDir, file), fullPage: true });

  const headings = await page
    .locator("h1, h2")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 12),
    );

  return {
    route,
    status: response?.status() ?? null,
    finalUrl: page.url(),
    title: await page.title(),
    headings,
    screenshot: file,
  };
}

/** Schreibt das Manifest je Sicht — ein Lauf kann DM- und Spielersicht enthalten. */
export function writeManifest(outputDir: string, scope: string, entries: VerifyUiEntry[]): void {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `manifest-${scope}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ scope, entries }, null, 2)}\n`, "utf8");
}
