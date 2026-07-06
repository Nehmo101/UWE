import { expect, test } from "@playwright/test";

/**
 * RTX Connector Client — homelab WebView smoke (Tauri shell or web preview).
 * Skipped in GitHub CI; run on a Windows/Linux homelab with the client built or
 * `pnpm connector:client:dev` serving :1420.
 *
 *   UWE_E2E_TAURI=1 UWE_CONNECTOR_CLIENT_URL=http://127.0.0.1:1420 pnpm test:e2e e2e/rtx-connector-client.spec.ts
 */
test.describe("RTX Connector Client (homelab)", () => {
  test("wizard shell loads and shows host connection panel", async ({ page }) => {
    test.skip(
      !process.env.UWE_E2E_TAURI,
      "Homelab only: set UWE_E2E_TAURI=1 with connector client dev/build. See docs/engineering/rtx-connector-release.md.",
    );

    const baseUrl = process.env.UWE_CONNECTOR_CLIENT_URL ?? "http://127.0.0.1:1420";
    await page.goto(baseUrl);

    await expect(page.getByRole("heading", { name: /UWE RTX Connector/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByLabel(/Host-URL/i)).toBeVisible();
    await expect(page.getByLabel(/Connector-Token/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Verbindung testen/i })).toBeVisible();
  });
});
