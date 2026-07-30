import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";
import { loginStudioForShellTests } from "./helpers/auth";
import {
  applyTheme,
  auditShell,
  AUDIT_VIEWPORTS,
  expectShellAuditClean,
  MIN_TOUCH_AA_PX,
  MIN_TOUCH_COARSE_PX,
} from "./helpers/shell-audit";

/**
 * Die Prüfung lief bis zum v3-Redesign auf genau einer Seite, einem Viewport
 * und einem Theme — und zeigte dabei auf `/today`, eine Route, die es im Studio
 * nicht mehr gibt. Genau in dieser Lücke konnten sich die Befunde verstecken,
 * die das Redesign ausgelöst haben: 10-px-Beschriftungen, 36-px-Menüknöpfe und
 * ein Kartenraster, das erst ab 1400 px umbrach.
 *
 * Jetzt ist es eine Matrix über Seiten × Viewports × Hell/Dunkel. axe deckt die
 * Semantik ab, `auditShell` das, was axe nicht sieht: waagerechtes Scrollen, zu
 * kleine Schrift, zu kleine Trefferflächen und eine Sprungmarke ins Leere.
 *
 * Jede Seite prüft zuerst ihre Überschrift. Ohne diesen Anker würde ein
 * Redirect auf die Anmeldeseite still durchgehen und die Matrix bewertete
 * fröhlich das Login-Formular.
 */

const PAGES = [
  { path: "/worlds", heading: "Welten" },
  { path: "/settings", heading: "Design & Startseite" },
  // Diese Seite trägt drei ResponsiveTables und ist damit der Anker dafür,
  // dass die Tabellenrollen die Mobilansicht überleben.
  { path: "/worlds/terra/labels?tab=templates", heading: "Label-Bibliothek" },
] as const;

test.describe("Studio accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  for (const target of PAGES) {
    test(`${target.path} hat keine WCAG-A/AA-Verstöße`, async ({ page }) => {
      await page.goto(target.path);
      await expect(page.getByRole("heading", { name: target.heading, exact: true })).toBeVisible();

      await expectNoA11yViolations(page, `Studio ${target.path}`);
    });
  }

  for (const viewport of AUDIT_VIEWPORTS) {
    for (const mode of ["hell", "dunkel"] as const) {
      test(`Etiketten-Tabellen tragen auf ${viewport.name} (${mode})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/worlds/terra/labels?tab=templates");
        await expect(page.getByRole("heading", { name: "Label-Bibliothek" })).toBeVisible();
        await applyTheme(page, mode);

        // Die Rolle muss auf jeder Breite erhalten bleiben: `display: flex`
        // nimmt sie sonst, und die Karten wären für Screenreader nur Text.
        await expect(page.getByRole("table", { name: "Etiketten-Vorlagen" })).toBeAttached();

        const result = await auditShell(page, MIN_TOUCH_AA_PX);
        expectShellAuditClean(
          result,
          `Studio /labels ${viewport.name} ${mode}`,
          MIN_TOUCH_AA_PX,
        );
      });

      test(`/worlds trägt auf ${viewport.name} (${mode})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/worlds");
        await expect(page.getByRole("heading", { name: "Welten", exact: true })).toBeVisible();
        await applyTheme(page, mode);

        const result = await auditShell(page, MIN_TOUCH_AA_PX);
        expectShellAuditClean(result, `Studio /worlds ${viewport.name} ${mode}`, MIN_TOUCH_AA_PX);
      });
    }
  }

  test("die Sprungmarke führt zum Inhalt", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page.getByRole("heading", { name: "Welten", exact: true })).toBeVisible();

    // Erst mit dem Fokus wird sie sichtbar — vorher steht sie außerhalb.
    // Sie muss das erste Ziel sein, sonst führt sie an nichts vorbei.
    await page.keyboard.press("Tab");
    const skip = page.locator("a.uwe-skip-link");
    await expect(skip).toBeFocused();

    await skip.press("Enter");

    // Der Fokus muss danach im Inhalt liegen, nicht nur die Bildlaufposition:
    // sonst führt die nächste Tab-Taste zurück in die Navigation.
    await expect(page.locator("#uwe-main")).toBeFocused();
  });
});

/**
 * Die 44-px-Regel greift nur an Zeigegeräten ohne Präzision (`pointer: coarse`,
 * siehe `design-v3/controls.css`). Playwright emuliert das über `hasTouch` am
 * Kontext — deshalb ein eigener Block statt einer Zeile in der Matrix oben.
 */
test.describe("Studio accessibility — Touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("/worlds erreicht auf dem Telefon das Daumenmaß", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page.getByRole("heading", { name: "Welten", exact: true })).toBeVisible();

    const result = await auditShell(page, MIN_TOUCH_COARSE_PX);
    expectShellAuditClean(result, "Studio /worlds Touch 390px", MIN_TOUCH_COARSE_PX);
  });
});
