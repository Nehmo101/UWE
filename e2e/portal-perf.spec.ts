import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";
import { measureWebVitals, recordPerfResult } from "./helpers/perf";

test.describe("Portal runtime perf", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("records Web Vitals for /worlds", async ({ page }) => {
    await page.goto("/worlds");
    await expect(page.getByRole("heading", { name: "Welten entdecken" })).toBeVisible();

    const vitals = await measureWebVitals(page);
    recordPerfResult({ route: "portal:/worlds", ...vitals });

    expect(vitals.lcp ?? vitals.fcp ?? vitals.load).toBeGreaterThan(0);
  });
});
