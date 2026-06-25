import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

test.describe("Portal accessibility smoke", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test("public /worlds/terra has no WCAG A/AA axe violations", async ({ page }) => {
    await page.goto("/worlds/terra");

    await expect(page.getByRole("heading", { name: "Terra" })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();

    await expectNoA11yViolations(page, "Portal /worlds/terra");
  });
});
