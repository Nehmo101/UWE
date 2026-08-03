import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

/**
 * QF10 label printing — Studio UI is covered in CI; physical print requires a
 * homelab Maschinenraum connector with CUPS or UWE_CONNECTOR_PRINT_CMD (not GitHub CI).
 * Manual QA checklist: docs/engine-connector.md#manual-qa-label-printing
 */
test.describe("Studio label print (QF10)", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudioForShellTests(page);
  });

  test("printers page renders inside SystemShell", async ({ page }) => {
    await page.goto("/system/printers");

    await expect(page.getByRole("link", { name: "UWE Studio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Drucker" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Suchen" })).toBeVisible();
  });

  test("physical label print via Maschinenraum host", async ({ page }) => {
    test.skip(
      !process.env.UWE_E2E_LABEL_PRINT,
      "Homelab only: set UWE_E2E_LABEL_PRINT=1 with Maschinenraum connector + stub/CUPS print. See docs/engine-connector.md#manual-qa-label-printing.",
    );

    await page.goto("/system/printers");
    await expect(page.getByRole("heading", { name: "Drucker" })).toBeVisible();

    const discover = page.getByRole("button", { name: "Suchen" });
    await discover.click();

    await expect(page.getByText(/Connector|Drucker|Warteschlange/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
