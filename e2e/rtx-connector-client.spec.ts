import { expect, test } from "@playwright/test";

/**
 * Command Center — homelab WebView smoke (Tauri shell or web preview).
 * Skipped in GitHub CI; run on a Windows/Linux homelab with the client built or
 * `pnpm connector:client:dev` serving :1420.
 *
 *   UWE_E2E_TAURI=1 UWE_CONNECTOR_CLIENT_URL=http://127.0.0.1:1420 pnpm test:e2e e2e/rtx-connector-client.spec.ts
 */
test.describe("Command Center (homelab)", () => {
  test("shell loads and reaches the Maschinenraum panel", async ({ page }) => {
    test.skip(
      !process.env.UWE_E2E_TAURI,
      "Homelab only: set UWE_E2E_TAURI=1 with connector client dev/build. See docs/engineering/rtx-connector-release.md.",
    );

    const baseUrl = process.env.UWE_CONNECTOR_CLIENT_URL ?? "http://127.0.0.1:1420";
    await page.goto(baseUrl);

    // Die Marke der Shell, nicht ein Panel-Titel: der Erststart kann den
    // Ersteinrichtungs-Assistenten darüberlegen.
    await expect(page.getByText("UWE Command Center").first()).toBeVisible({ timeout: 30_000 });

    // Assistent wegklicken, falls diese Installation noch keine Auswahl hat.
    const postpone = page.getByRole("button", { name: "Später" });
    if (await postpone.isVisible().catch(() => false)) {
      await postpone.click();
    }

    await page.getByRole("link", { name: "Maschinenraum" }).first().click();
    await expect(page.getByLabel(/Connector-Token/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Verbindung testen/i })).toBeVisible();
  });

  test("install wizard offers the four areas on first start", async ({ page }) => {
    test.skip(!process.env.UWE_E2E_TAURI, "Homelab only: set UWE_E2E_TAURI=1.");

    await page.goto(process.env.UWE_CONNECTOR_CLIENT_URL ?? "http://127.0.0.1:1420");

    const wizard = page.getByRole("dialog", { name: /Was soll auf diesem Rechner laufen/i });
    test.skip(
      !(await wizard.isVisible().catch(() => false)),
      "Diese Installation hat bereits eine App-Auswahl — der Assistent springt nicht mehr auf.",
    );

    for (const area of ["Studio", "Portal", "Brain", "Family"]) {
      await expect(wizard.getByRole("checkbox", { name: new RegExp(area) })).toBeVisible();
    }
  });
});
