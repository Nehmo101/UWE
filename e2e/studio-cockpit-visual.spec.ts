import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio world dashboard on WorldShell", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("world dashboard shows WorldShell chrome", async ({ page }) => {
    await page.goto("/worlds/terra/dashboard");

    await expect(page.getByRole("link", { name: "Terra", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Terra");
    await expect(page.getByRole("heading", { level: 1, name: "Terra" })).toHaveCount(1);

    // Die Sidebar-Gruppen sind zusammenklappbar; offen ist nur die mit der
    // aktiven Route. Auf dem Cockpit ist das „Übersicht", „Wiki" liegt
    // eingeklappt darunter. Der Test erwartete Sichtbarkeit, die es nie gab.
    const wikiGroup = page.getByRole("button", { name: "Wiki" });
    await expect(wikiGroup).toHaveAttribute("aria-expanded", "false");
    await wikiGroup.click();
    await expect(page.getByRole("link", { name: "Wiki / Seiten" })).toBeVisible();
  });

  test("studio defaults to Gemalte-Welt accent tokens", async ({ page }) => {
    await page.goto("/worlds/terra/dashboard");

    const themeId = await page.evaluate(() => document.documentElement.dataset.uweTheme);
    expect(themeId).toBe("uwe-ghibli-tag");

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--uwe-accent").trim(),
    );
    expect(accent.toLowerCase()).toBe("#c2622b");
  });
});
