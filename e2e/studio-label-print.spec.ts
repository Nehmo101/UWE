import { expect, test } from "@playwright/test";
import { loginStudioForShellTests } from "./helpers/auth";

/**
 * QF10 label printing — Studio UI is covered in CI; physical print requires a
 * homelab RTX connector with CUPS or UWE_CONNECTOR_PRINT_CMD (not GitHub CI).
 * Manual QA checklist: docs/rtx-connector.md#manual-qa-label-printing
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

  test("physical label print via RTX host", async () => {
    test.skip(
      !process.env.UWE_E2E_LABEL_PRINT,
      "Homelab only: set UWE_E2E_LABEL_PRINT=1 with RTX connector + CUPS. See docs/rtx-connector.md#manual-qa-label-printing.",
    );
    // Future: drive world label UI → queue → connector stub when homelab harness exists.
  });
});
