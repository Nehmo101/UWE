import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal shell chrome", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test("legacy /worlds redirects unauthenticated visitors to login", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page).toHaveURL(/\/login/);
  });

  test.describe("authenticated player", () => {
    test.beforeEach(async ({ page }) => {
      await loginPortalPlayer(page);
    });

    test("PortalShell on auth worlds hub", async ({ page }) => {
      await page.goto("/auth/worlds");

      await expect(page.getByRole("link", { name: "UWE Portal" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Meine Welten" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Meine Welten" })).toBeVisible();
    });

    test("PortalShell on authenticated world page", async ({ page }) => {
      await page.goto("/auth/worlds/terra");

      await expect(page.getByRole("link", { name: "Terra", exact: true }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Sessions \/ Recaps/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
    });

    test("PortalShell account password page", async ({ page }) => {
      await page.goto("/auth/account/password");

      await expect(page.getByRole("link", { name: "Passwort" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Passwort ändern" })).toBeVisible();
    });
  });
});
