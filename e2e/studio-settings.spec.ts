import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

/**
 * Settings E2E on the new StudioShell + SettingsShell layout.
 * Blocked until Wave 3 C1 migrates `/settings` off legacy `StudioAppShell`.
 */
test.describe("Studio settings on new shell", () => {
  test.skip(
    true,
    "Pending C1: migrate /settings from StudioAppShell to StudioShell + SettingsShell",
  );

  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("SettingsShell renders inside StudioShell", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByRole("link", { name: "UWE Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin- & Systemeinstellungen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Einstellungen" })).toBeVisible();
  });
});
