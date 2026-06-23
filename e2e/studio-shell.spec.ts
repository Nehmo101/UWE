import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio shell chrome", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("WorldModuleShell shows sectioned sidebar on world home", async ({ page }) => {
    await page.goto("/worlds/terra");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Terra");
    await expect(page.locator(".uwe-sidebar")).toContainText("Welten & Kampagnen");
    await expect(page.locator(".uwe-sidebar")).toContainText("Daily Admin OS");
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("WorldModuleShell wiki page shows breadcrumbs and back link", async ({ page }) => {
    await page.goto("/worlds/terra/lore/amans-geheimnis");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.locator(".uwe-back-link")).toContainText("Seitenliste");
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Lore");
    await expect(page.getByRole("heading", { name: "Amans Geheimnis" })).toBeVisible();
  });

  test("AdminModuleShell renders Daily Admin chrome on /today", async ({ page }) => {
    await page.goto("/today");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Daily Admin OS");
    await expect(page.locator(".uwe-sidebar")).toContainText("Capture");
  });

  test("AdminModuleShell highlights Capture in sidebar", async ({ page }) => {
    await page.goto("/capture");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Capture Inbox" })).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Daily Admin OS");
  });

  test("StudioAppShell renders settings navigation", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.locator(".uwe-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin- & Systemeinstellungen" })).toBeVisible();
    await expect(page.locator(".uwe-sidebar")).toContainText("Einstellungen");
  });
});
