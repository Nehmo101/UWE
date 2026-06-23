import { expect, type Page } from "@playwright/test";

export async function loginStudio(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("dm@uwe.local");
  await page.getByLabel("Passwort").fill("uwe-dev");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/studio/);
}

/** Session cookie + Cloudflare Access header for exposed Studio routes in production E2E. */
export async function loginStudioForShellTests(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: "dm@uwe.local", password: "uwe-dev" },
  });
  expect(response.ok()).toBeTruthy();
  await page.setExtraHTTPHeaders({
    "cf-access-authenticated-user-email": "dm@uwe.local",
  });
}

export async function loginPortalPlayer(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("aman@uwe.local");
  await page.getByLabel("Passwort").fill("uwe-dev");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/auth\/worlds/);
}
