import { expect, test } from "@playwright/test";

test.describe("Studio password reset", () => {
  test("forgot-password shows neutral success message", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("E-Mail").fill("dm@uwe.local");
    await page.getByRole("button", { name: "Reset-Link anfordern" }).click();
    await expect(page.locator("body")).toContainText(/Falls ein Konto/i);
  });
});
