import { expect, test } from "@playwright/test";

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
