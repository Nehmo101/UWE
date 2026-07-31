import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";
import { loginPortalPlayer } from "./helpers/auth";
import {
  applyTheme,
  auditShell,
  AUDIT_VIEWPORTS,
  expectShellAuditClean,
  MIN_TOUCH_AA_PX,
  MIN_TOUCH_COARSE_PX,
} from "./helpers/shell-audit";

/**
 * Gegenstück zu `studio-a11y.spec.ts`. Das Portal ist die Fläche, die Spieler
 * am häufigsten auf dem Telefon öffnen — die Viewport-Matrix zählt hier noch
 * mehr als im Studio.
 *
 * Die vorige Fassung prüfte ein öffentliches `/worlds/terra`. Diese Route gibt
 * es im Portal nicht (und gab es zuletzt nicht mehr): Welt-Seiten liegen unter
 * `/auth/worlds/...` und setzen eine Spieler-Sitzung voraus. Der Aufruf landete
 * deshalb auf der Anmeldeseite — geprüft wurde also stillschweigend das
 * Login-Formular statt des Portals. Die Überschriften-Assertions unten schließen
 * diese Lücke.
 */

const PAGES = [
  { path: "/auth/worlds", heading: "Meine Welten" },
  { path: "/auth/worlds/terra", heading: "Terra" },
] as const;

test.describe("Portal accessibility", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  for (const target of PAGES) {
    test(`${target.path} hat keine WCAG-A/AA-Verstöße`, async ({ page }) => {
      await page.goto(target.path);
      await expect(page.getByRole("heading", { name: target.heading })).toBeVisible();

      await expectNoA11yViolations(page, `Portal ${target.path}`);
    });
  }

  for (const viewport of AUDIT_VIEWPORTS) {
    for (const mode of ["hell", "dunkel"] as const) {
      test(`/auth/worlds/terra trägt auf ${viewport.name} (${mode})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/auth/worlds/terra");
        await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
        await applyTheme(page, mode);

        const result = await auditShell(page, MIN_TOUCH_AA_PX);
        expectShellAuditClean(
          result,
          `Portal /auth/worlds/terra ${viewport.name} ${mode}`,
          MIN_TOUCH_AA_PX,
        );
      });
    }
  }
});

/**
 * Die 44-px-Regel greift nur an Zeigegeräten ohne Präzision (`pointer: coarse`,
 * siehe `design-v3/controls.css`). Playwright emuliert das über `hasTouch`.
 */
test.describe("Portal accessibility — Touch", () => {
  test.use({
    baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("/auth/worlds/terra erreicht auf dem Telefon das Daumenmaß", async ({ page }) => {
    await page.goto("/auth/worlds/terra");
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();

    const result = await auditShell(page, MIN_TOUCH_COARSE_PX);
    expectShellAuditClean(result, "Portal /auth/worlds/terra Touch 390px", MIN_TOUCH_COARSE_PX);
  });
});
