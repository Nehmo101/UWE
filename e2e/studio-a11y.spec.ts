import { expect, test } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";
import { loginStudioForShellTests } from "./helpers/auth";

test.describe("Studio accessibility smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("/today has no WCAG A/AA axe violations", async ({ page }) => {
    await page.goto("/today");

    await expect(page.getByRole("heading", { name: "Heute", exact: true })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();

    await expectNoA11yViolations(page, "Studio /today");
  });
});
