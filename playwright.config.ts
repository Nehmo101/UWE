import { defineConfig, devices } from "@playwright/test";

const studioPort = process.env.E2E_STUDIO_PORT ?? "3199";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3200";
const studioBaseURL = process.env.E2E_STUDIO_URL ?? `http://127.0.0.1:${studioPort}`;
const portalBaseURL = process.env.E2E_PORTAL_URL ?? `http://127.0.0.1:${portalPort}`;

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
  ],
  use: {
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/e2e-servers.mjs",
    url: `${studioBaseURL}/login`,
    reuseExistingServer: !process.env.CI,
    // e2e-servers.mjs runs migrate + seed + zwei next-Builds vor dem Start;
    // auf GitHub-Runnern dauert das inzwischen >5 Minuten (CI-Job-Budget: 20).
    timeout: 900_000,
  },
});
