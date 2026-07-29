import { expect, test } from "@playwright/test";

test.describe("Studio auth", () => {
  test("login redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("dm@uwe.local");
    await page.getByLabel("Passwort").fill("uwe-dev");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/worlds/);
  });

  test("invalid login shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill("dm@uwe.local");
    await page.getByLabel("Passwort").fill("wrong-password");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page.getByText(/Ungültige Anmeldedaten/)).toBeVisible();
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page).toHaveURL(/\/login/);
  });
});
