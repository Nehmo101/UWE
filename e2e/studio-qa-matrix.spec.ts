import { test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";
import {
  QA_STUDIO_ROUTES,
  QA_THEME_PRESETS,
  forceThemePreset,
  recordDefects,
  scanContrast,
  screenshotPath,
} from "./helpers/qa-matrix";

// WP-H manual browser QA sweep. Opt-in via QA_MATRIX=1 (pnpm qa:theme-matrix);
// excluded from the normal e2e gate to keep it fast.
test.describe("Studio theme matrix QA", () => {
  test.skip(!process.env.QA_MATRIX, "set QA_MATRIX=1 to run the theme-matrix sweep");

  for (const preset of QA_THEME_PRESETS) {
    for (const route of QA_STUDIO_ROUTES) {
      test(`${preset} · ${route.id}`, async ({ page }) => {
        await forceThemePreset(page, "studio", preset);
        await loginStudioForShellTests(page);
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        await page.screenshot({
          path: screenshotPath("studio", route.id, preset),
          fullPage: true,
        });

        const defects = await scanContrast(page, "studio", route.id, preset);
        if (defects.length > 0) recordDefects(defects);
      });
    }
  }
});
