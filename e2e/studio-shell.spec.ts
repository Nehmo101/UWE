import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio shell chrome (new AppShell)", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("WorldShell shows world sidebar on world home", async ({ page }) => {
    await page.goto("/worlds/terra");

    await expect(page.getByRole("link", { name: "Terra", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Terra");
    await expect(page.getByRole("link", { name: "Wiki / Seiten" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
  });

  test("WorldShell wiki page shows breadcrumbs", async ({ page }) => {
    await page.goto("/worlds/terra/lore/amans-geheimnis");

    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Lore");
    await expect(page.getByRole("heading", { name: "Amans Geheimnis" })).toBeVisible();
  });

  test("StudioShell renders Daily Admin chrome on /today", async ({ page }) => {
    await page.goto("/today");

    await expect(page.getByRole("link", { name: "UWE Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Heute" })).toBeVisible();
  });

  test("StudioShell highlights Capture in sidebar", async ({ page }) => {
    await page.goto("/capture");

    await expect(page.getByRole("heading", { name: "Capture Inbox" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capture / Inbox" })).toBeVisible();
  });
});
