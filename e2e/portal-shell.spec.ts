import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal shell chrome", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("legacy /worlds discover redirects to authenticated hub", async ({ page }) => {
    await page.goto("/worlds");

    await expect(page).toHaveURL(/\/auth\/worlds/);
    await expect(page.locator(".uwe-v2-shell")).toBeVisible();
  });

  test("legacy /worlds/[slug] redirects to authenticated world home", async ({ page }) => {
    await page.goto("/worlds/terra");

    await expect(page).toHaveURL(/\/auth\/worlds\/terra/);
    await expect(page.locator(".uwe-v2-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("PortalAppShell on authenticated world page without account sidebar", async ({ page }) => {
    await page.goto("/auth/worlds/terra");

    await expect(page.locator(".uwe-v2-shell")).toBeVisible();
    await expect(page.locator("#uwe-v2-sidebar")).toContainText("Sessions");
    await expect(page.locator("#uwe-v2-sidebar")).not.toContainText("Passwort");
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("PortalAppShell shows account sidebar on account settings", async ({ page }) => {
    await page.goto("/auth/account/password");

    await expect(page.locator(".uwe-v2-shell")).toBeVisible();
    await expect(page.locator("#uwe-v2-sidebar")).toContainText("Account");
    await expect(page.locator("#uwe-v2-sidebar")).toContainText("Passwort");
    await expect(page.getByRole("heading", { name: "Passwort ändern" })).toBeVisible();
  });
});
