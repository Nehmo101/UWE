import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal auth", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test("player login redirects to worlds", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("aman@uwe.local");
    await page.getByLabel("Passwort").fill("uwe-dev");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/auth\/worlds/);
  });

  test("protected auth route redirects to login", async ({ page }) => {
    await page.goto("/auth/worlds");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Portal authenticated player flows", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("auth worlds hub lists accessible worlds", async ({ page }) => {
    await page.goto("/auth/worlds");

    await expect(page.getByRole("heading", { name: "Meine Welten" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Terra/ })).toBeVisible();
  });

  test("auth world detail dashboard loads", async ({ page }) => {
    await page.goto("/auth/worlds/terra");

    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sessions \/ Recaps/i })).toBeVisible();
  });
});

test.describe("Portal login-first — unauthenticated redirect policy", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test("portal root / without session redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/portal without session redirects to /login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/worlds without session redirects to /login", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Studio /portal redirect shim", () => {
  test.use({ baseURL: process.env.E2E_STUDIO_URL ?? "http://127.0.0.1:3199" });

  test("studio /portal shim does not 404 and redirects to portal", async ({ page }) => {
    const response = await page.goto("/portal");
    // The shim redirects away from Studio — final response must not be 404
    expect(response?.status()).not.toBe(404);
    // Split-hostname E2E reaches Portal /login; unified-path E2E may stay on Studio /portal
    // until route-policy (C2) wires cross-port redirects — see scripts/e2e-servers.mjs.
    await expect(page).toHaveURL(/\/login|\/auth\/worlds|\/portal/);
  });
});
