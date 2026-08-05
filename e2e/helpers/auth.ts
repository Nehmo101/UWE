import { expect, type Page } from "@playwright/test";

export async function loginStudio(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("dm@uwe.local");
  await page.getByLabel("Passwort").fill("uwe-dev");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/worlds/);
}

/** Establishes a Studio session cookie (UWE e-mail login) for shell/API tests. */
export async function loginStudioForShellTests(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: "dm@uwe.local", password: "uwe-dev" },
  });
  expect(response.ok()).toBeTruthy();
}

/**
 * Anmeldung als Spieler im Portal.
 *
 * Nach dem Anmelden springt das Portal bei **genau einer** zugeordneten Welt
 * direkt in diese Welt (`/auth/worlds` → `/auth/worlds/<slug>`, siehe
 * `apps/portal/app/auth/worlds/(hub)/page.tsx`). Der Test muss deshalb warten,
 * bis diese Weiterleitung durch ist — sonst reißt sie die nächste Navigation
 * ab (`net::ERR_ABORTED`), und der Fehler sieht aus wie eine kaputte Seite.
 */
export async function loginPortalPlayer(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("aman@uwe.local");
  await page.getByLabel("Passwort").fill("uwe-dev");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/auth\/worlds/);
  await page.waitForLoadState("networkidle");
}

/**
 * Sitzung für Brain und Family.
 *
 * Beide Apps haben **kein eigenes Anmeldeformular** — das ist Absicht und
 * keine Lücke: ihre `/login`-Seiten verlinken nur auf die UWE-Origin, weil es
 * dort eine Sitzung gibt und hier keine Selbstregistrierung geben soll (siehe
 * `apps/brain/app/login/page.tsx`). Der Test meldet sich deshalb über die
 * Studio-API an und wechselt danach auf die Ziel-Origin. Das funktioniert,
 * weil Cookies host- und nicht port-gebunden sind: dasselbe `127.0.0.1` trägt
 * die Sitzung über alle vier Testserver.
 *
 * Das Häkchen für Brain bzw. Family setzt `scripts/e2e-grant-areas.ts` nach
 * dem Seed — der Dev-Seed vergibt bewusst nur Portal und Studio.
 */
async function loginViaStudioOrigin(page: Page): Promise<void> {
  const studioUrl = process.env.E2E_STUDIO_URL ?? `http://127.0.0.1:${process.env.E2E_STUDIO_PORT ?? "3199"}`;
  const response = await page.request.post(`${studioUrl}/api/auth/login`, {
    data: { email: "dm@uwe.local", password: "uwe-dev" },
  });
  expect(response.ok(), `Anmeldung auf ${studioUrl} fehlgeschlagen (${response.status()})`).toBeTruthy();
}

export async function loginBrain(page: Page): Promise<void> {
  await loginViaStudioOrigin(page);
}

export async function loginFamily(page: Page): Promise<void> {
  await loginViaStudioOrigin(page);
}
