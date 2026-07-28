import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";
import { measureWebVitals, recordPerfResult } from "./helpers/perf";

test.describe("Studio runtime perf", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("records Web Vitals for /worlds", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page.getByRole("heading", { name: "Welten", exact: true })).toBeVisible();

    const vitals = await measureWebVitals(page);
    recordPerfResult({ route: "studio:/worlds", ...vitals });

    // Sanity: a metric was captured. Budget enforcement is done by
    // scripts/perf-budget-check.mjs against the recorded results file.
    expect(vitals.lcp ?? vitals.fcp ?? vitals.load).toBeGreaterThan(0);
  });
});
