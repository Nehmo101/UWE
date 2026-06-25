import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio cockpit visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("world cockpit dashboard shows mockup chrome", async ({ page }) => {
    await page.goto("/worlds/terra/dashboard");

    await expect(page.locator(".uwe-v2-shell")).toBeVisible();
    await expect(page.locator(".uwe-cockpit-topbar")).toBeVisible();
    await expect(page.locator(".uwe-cockpit-beta-badge")).toHaveText("BETA");
    await expect(page.locator(".uwe-cockpit-world-select")).toBeVisible();
    await expect(page.locator(".uwe-cockpit-command-hint")).toBeVisible();
    await expect(page.locator(".uwe-status-footer")).toBeVisible();
    await expect(page.locator(".uwe-status-footer")).toContainText("LLM");
    await expect(page.locator(".uwe-status-footer")).toContainText("Embeddings");

    await expect(page.locator(".uwe-cockpit-header")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terra", level: 1 })).toBeVisible();
    await expect(page.locator(".uwe-cockpit-tabs")).toBeVisible();
    await expect(page.locator(".uwe-cockpit-tab.active")).toContainText("Übersicht");
    await expect(page.locator(".uwe-cockpit-grid")).toBeVisible();
    await expect(page.locator(".uwe-cockpit-card")).toHaveCount(6);

    await expect(page.locator("#uwe-v2-sidebar")).toContainText("Portal");
    await expect(page.locator("#uwe-v2-sidebar")).toContainText("Bibliothek");
    await expect(page.locator(".uwe-v2-rail")).toBeVisible();
    await expect(page.locator(".uwe-v2-rail-link").first()).toBeVisible();
  });

  test("studio defaults to Parchment OS accent tokens", async ({ page }) => {
    await page.goto("/worlds/terra/dashboard");

    const themeId = await page.evaluate(() => document.documentElement.dataset.uweTheme);
    expect(themeId).toBe("uwe-parchment-os");

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--uwe-accent").trim(),
    );
    expect(accent.toLowerCase()).toBe("#c2622b");
  });
});
