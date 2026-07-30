import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

/**
 * Chrome-Prüfung der beiden Studio-Shells.
 *
 * Zwei Tests zeigten bis zuletzt auf `/today` und `/capture` — Routen, die das
 * Studio nicht mehr hat. Sie liefen also gegen 404-Seiten und konnten am
 * Shell-Chrome gar nichts mehr feststellen. Die Alltags-Sektion heißt heute
 * „Erfassen & Alltag" und hat mit `/continue` genau einen aktiven Eintrag;
 * dorthin zeigen sie jetzt.
 *
 * Der dritte Test scheiterte an etwas anderem: die Sidebar-Gruppen sind
 * zusammenklappbar, und offen ist nur die Gruppe mit der aktiven Route (plus
 * „Start"/„Welten"). Auf `/worlds/terra` ist das „Übersicht" — „Wiki" liegt
 * eingeklappt darunter. Der Test klappt sie jetzt auf, statt Sichtbarkeit zu
 * erwarten, die es nie gab.
 */

test.describe("Studio shell chrome (new AppShell)", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("WorldShell shows world sidebar on world home", async ({ page }) => {
    // `/worlds/terra` leitet auf die zuletzt besuchte Unterseite weiter,
    // ohne Cookie also auf `/dashboard`.
    await page.goto("/worlds/terra");

    await expect(page.getByRole("link", { name: "Terra", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Terra");
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();

    // Die aktive Gruppe ist „Übersicht"; „Wiki" muss erst aufgeklappt werden.
    const wikiGroup = page.getByRole("button", { name: "Wiki" });
    await expect(wikiGroup).toHaveAttribute("aria-expanded", "false");
    await wikiGroup.click();
    await expect(page.getByRole("link", { name: "Wiki / Seiten" })).toBeVisible();
  });

  test("WorldShell wiki page shows breadcrumbs", async ({ page }) => {
    await page.goto("/worlds/terra/lore/amans-geheimnis");

    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Lore");
    await expect(page.getByRole("heading", { name: "Amans Geheimnis" })).toBeVisible();
  });

  test("StudioShell renders global chrome on /continue", async ({ page }) => {
    await page.goto("/continue");

    await expect(page.getByRole("link", { name: "UWE Studio" }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mach weiter, wo du aufgehört hast" }),
    ).toBeVisible();
  });

  test("StudioShell highlights the active area in the sidebar", async ({ page }) => {
    await page.goto("/continue");

    // Die Gruppe mit der aktiven Route wird immer aufgeklappt — sonst wäre die
    // eigene Position in der Navigation nicht auffindbar.
    await expect(page.getByRole("button", { name: "Erfassen & Alltag" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // `aria-current="page"` ist das, was ein Screenreader vorliest; die
    // Hintergrundfarbe allein wäre keine Auszeichnung.
    const active = page.getByRole("link", { name: "Mach weiter" });
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute("aria-current", "page");
  });
});
