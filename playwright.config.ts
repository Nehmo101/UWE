import { defineConfig, devices } from "@playwright/test";

const studioPort = process.env.E2E_STUDIO_PORT ?? "3199";
const portalPort = process.env.E2E_PORTAL_PORT ?? "3200";
const studioBaseURL = process.env.E2E_STUDIO_URL ?? `http://127.0.0.1:${studioPort}`;
const portalBaseURL = process.env.E2E_PORTAL_URL ?? `http://127.0.0.1:${portalPort}`;

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
        baseURL: studioBaseURL,
      },
    },
    {
      name: "portal",
      testMatch: /portal-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
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
    timeout: 300_000,
  },
});
