import { test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";
import {
  captureRoute,
  verifyUiOutputDir,
  verifyUiRoutes,
  writeManifest,
  type VerifyUiEntry,
} from "./helpers/verify-ui";

/**
 * Gezielter Screenshot-Lauf aus Sicht der Spielleitung.
 *
 * Läuft nur über `pnpm verify:ui` (setzt VERIFY_UI_ROUTES und VERIFY_UI_OUT) und
 * bleibt in der normalen Suite still — er beantwortet eine Frage von Hand, er
 * bewacht nichts.
 */
const routes = verifyUiRoutes();
const outputDir = verifyUiOutputDir();
const entries: VerifyUiEntry[] = [];

test.describe("verify:ui — Sicht der Spielleitung", () => {
  test.skip(
    routes.length === 0 || !outputDir || process.env.VERIFY_UI_AS !== "dm",
    "nur über „pnpm verify:ui --als dm“",
  );

  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  for (const route of routes) {
    test(`Studio ${route}`, async ({ page }) => {
      entries.push(await captureRoute(page, "studio", route, outputDir));
    });
  }

  test.afterAll(() => {
    if (entries.length > 0) writeManifest(outputDir, "studio", entries);
  });
});
