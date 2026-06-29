import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio settings on new shell", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("SettingsShell renders inside SystemShell", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("link", { name: "UWE Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin- & Systemeinstellungen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Einstellungen" })).toBeVisible();
  });
});
