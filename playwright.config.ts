import { defineConfig, devices } from "@playwright/test";

const studioPort = process.env.E2E_STUDIO_PORT ?? "3199";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3200";
const brainPort = process.env.E2E_BRAIN_PORT ?? "3201";
const familyPort = process.env.E2E_FAMILY_PORT ?? "3202";
const studioBaseURL = process.env.E2E_STUDIO_URL ?? `http://127.0.0.1:${studioPort}`;
const portalBaseURL = process.env.E2E_PORTAL_URL ?? `http://127.0.0.1:${portalPort}`;
const brainBaseURL = process.env.E2E_BRAIN_URL ?? `http://127.0.0.1:${brainPort}`;
const familyBaseURL = process.env.E2E_FAMILY_URL ?? `http://127.0.0.1:${familyPort}`;

/**
 * Ausführbare Chromium-Datei aus der Umgebung statt aus Playwrights Download.
 *
 * Manche Container bringen einen vorinstallierten Chromium mit, dessen
 * Build-Nummer nicht zur hier gepinnten Playwright-Version passt. Playwright
 * sucht dann eine Datei, die es nie geben wird, und jeder Test scheitert am
 * Start — obwohl ein brauchbarer Browser vorhanden ist. Ist die Variable nicht
 * gesetzt (CI, lokale Entwicklung mit `playwright install`), ändert sich nichts.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    {
      name: "studio",
      testMatch: /studio-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...launchOptions,
        baseURL: studioBaseURL,
      },
    },
    {
      name: "portal",
      testMatch: /portal-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...launchOptions,
        baseURL: portalBaseURL,
      },
    },
    /**
     * Brain und Family. Beide haben kein eigenes Anmeldeformular — die Sitzung
     * entsteht auf der Studio-Origin und trägt über das gemeinsame Cookie
     * herüber (`loginBrain` / `loginFamily` in e2e/helpers/auth.ts). Die
     * `baseURL` zeigt trotzdem auf die jeweilige App, damit ein `page.goto("/")`
     * im Test dort landet, wo er hingehört.
     */
    {
      name: "brain",
      testMatch: /brain-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...launchOptions,
        baseURL: brainBaseURL,
      },
    },
    {
      name: "family",
      testMatch: /family-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...launchOptions,
        baseURL: familyBaseURL,
      },
    },
  ],
  use: {
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/e2e-servers.mjs",
    url: `${studioBaseURL}/login`,
    reuseExistingServer: !process.env.CI,
    // e2e-servers.mjs runs migrate + seed + **vier** next-Builds vor dem Start.
    // Waren es zwei (Studio, Portal) und rund fünf Minuten; Brain und Family
    // kamen dazu, damit ihre Flächen überhaupt im Browser geprüft werden.
    // Beide sind deutlich kleiner als Studio, die Verdopplung der Anzahl ist
    // also keine Verdopplung der Zeit — der Puffer verdoppelt sich trotzdem,
    // weil ein Timeout hier den ganzen Lauf ohne einen einzigen Test beendet.
    timeout: 1_800_000,
  },
});
