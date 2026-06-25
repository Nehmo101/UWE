import { test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";
import {
  QA_PORTAL_ROUTES,
  QA_THEME_PRESETS,
  forceThemePreset,
  recordDefects,
  scanContrast,
  screenshotPath,
} from "./helpers/qa-matrix";

// WP-H manual browser QA sweep. Opt-in via QA_MATRIX=1 (pnpm qa:theme-matrix).
test.describe("Portal theme matrix QA", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });
  test.skip(!process.env.QA_MATRIX, "set QA_MATRIX=1 to run the theme-matrix sweep");

  for (const preset of QA_THEME_PRESETS) {
    for (const route of QA_PORTAL_ROUTES) {
      test(`${preset} · ${route.id}`, async ({ page }) => {
        await forceThemePreset(page, "portal", preset);
        await loginPortalPlayer(page);
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        await page.screenshot({
          path: screenshotPath("portal", route.id, preset),
          fullPage: true,
        });

        const defects = await scanContrast(page, "portal", route.id, preset);
        if (defects.length > 0) recordDefects(defects);
      });
    }
  }
});
