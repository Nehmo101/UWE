import { test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";
import {
  captureRoute,
  verifyUiOutputDir,
  verifyUiRoutes,
  writeManifest,
  type VerifyUiEntry,
} from "./helpers/verify-ui";

/**
 * Gezielter Screenshot-Lauf aus Spielersicht.
 *
 * Kein Beiwerk zur DM-Sicht, sondern der Grund für die halbe Übung: „Für Spieler
 * hat sich nichts geändert" ist eine Behauptung, die man zeigen können muss —
 * und zwar durch dieselben Guards, durch die auch ein echter Spieler liest.
 */
const routes = verifyUiRoutes();
const outputDir = verifyUiOutputDir();
const entries: VerifyUiEntry[] = [];

test.describe("verify:ui — Spielersicht", () => {
  test.skip(
    routes.length === 0 || !outputDir || process.env.VERIFY_UI_AS !== "spieler",
    "nur über „pnpm verify:ui --als spieler“",
  );

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  for (const route of routes) {
    test(`Portal ${route}`, async ({ page }) => {
      entries.push(await captureRoute(page, "portal", route, outputDir));
    });
  }

  test.afterAll(() => {
    if (entries.length > 0) writeManifest(outputDir, "portal", entries);
  });
});
