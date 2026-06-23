import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal shell chrome", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("PortalPublicShell on /worlds discover page", async ({ page }) => {
    await page.goto("/worlds");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welten entdecken" })).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Welten entdecken");
    await expect(page.locator(".uwe-sidebar")).toContainText("Meine Welten");
    await expect(page.getByRole("link", { name: /Welt betreten/i })).toBeVisible();
  });

  test("PortalPublicShell on public world home", async ({ page }) => {
    await page.goto("/worlds/terra");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Terra");
    await expect(page.getByRole("link", { name: /Alle Welten/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("PortalAppShell on authenticated world page without account sidebar", async ({ page }) => {
    await page.goto("/auth/worlds/terra");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Sessions");
    await expect(page.locator(".uwe-sidebar")).not.toContainText("Passwort");
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("PortalAppShell shows account sidebar on account settings", async ({ page }) => {
    await page.goto("/auth/account/password");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Account");
    await expect(page.locator(".uwe-sidebar")).toContainText("Passwort");
    await expect(page.getByRole("heading", { name: "Passwort ändern" })).toBeVisible();
  });
});
