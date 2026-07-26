import { expect, test, type Page } from "@playwright/test";

/**
 * Passkey (WebAuthn) end-to-end flow with Chrome's virtual authenticator:
 * enable the toggle → register a passkey → logout → passkey login.
 *
 * RP-ID caveat: Chrome rejects IP-address RP IDs, and the default e2e baseURL
 * is `http://127.0.0.1:<port>`. The suite therefore rewrites its navigation to
 * `localhost` (same server, same port) — the app derives the RP ID from the
 * request host in the local deployment model, so `localhost` is a valid RP ID.
 */

function toLocalhost(url: string): string {
  return url.replace("127.0.0.1", "localhost");
}

async function withVirtualAuthenticator(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

async function passwordLogin(page: Page, baseURL: string): Promise<void> {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("E-Mail").fill("dm@uwe.local");
  await page.getByLabel("Passwort").fill("uwe-dev");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
}

async function setPasskeysToggle(page: Page, baseURL: string, enabled: boolean): Promise<void> {
  await page.goto(`${baseURL}/settings?tab=login`);
  // The shell renders the tab content twice (desktop + mobile layout) — scope
  // to the first form containing the toggle.
  const form = page.locator('form:has(input[name="passkeysEnabled"])').first();
  const toggle = form.locator('input[name="passkeysEnabled"]');
  await expect(toggle).toBeAttached();
  if (enabled) {
    await toggle.check();
  } else {
    await toggle.uncheck();
  }
  await form.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/tab=login/);
}

test.describe("Studio passkeys", () => {
  test("register a passkey and sign in with it", async ({ page, baseURL }) => {
    const base = toLocalhost(baseURL ?? "http://localhost:3199");
    await withVirtualAuthenticator(page);

    await passwordLogin(page, base);
    await setPasskeysToggle(page, base, true);

    try {
      // Register a passkey on the account security page.
      await page.goto(`${base}/account/security`);
      await page.getByLabel("Name des neuen Passkeys").first().fill("E2E-Testgerät");
      await page.getByRole("button", { name: "Passkey registrieren" }).first().click();
      await expect(page.getByText("Passkey wurde registriert").first()).toBeVisible();

      // Logout, then sign in using only the passkey.
      await page.goto(`${base}/logout`);
      await page.goto(`${base}/login`);
      await page.getByRole("button", { name: "Mit Passkey anmelden" }).first().click();
      await expect(page).toHaveURL(/\/today/);

      // Cleanup: remove the credential so reruns start clean.
      await page.goto(`${base}/account/security`);
      page.on("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Entfernen" }).first().click();
      await expect(page.getByText("Passkey wurde entfernt.").first()).toBeVisible();
    } finally {
      // Always restore the default so later specs see the untouched login page.
      await setPasskeysToggle(page, base, false);
    }
  });
});
