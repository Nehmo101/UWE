import { expect, test } from "@playwright/test";

import { loginPortalPlayer } from "./helpers/auth";

test.describe("Portal Atlas 3D", () => {
  test.use({ baseURL: process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200" });

  test("toggles the server-filtered player Atlas into WebGL", async ({ page }) => {
    await loginPortalPlayer(page);
    await page.goto("/auth/worlds/terra/atlas");
    const nodeLinks = page.locator('a[href^="/auth/worlds/terra/atlas/"]');
    test.skip((await nodeLinks.count()) === 0, "Seed database has no player-visible Atlas node");
    await nodeLinks.first().click();

    const toggle = page.getByRole("button", { name: "3D Gelände" });
    await expect(toggle).toBeVisible();
    const webgl = await page.locator('canvas[aria-label^="Atlas-Karte:"]').evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webgl, "Chromium has no WebGL/SwiftShader context");

    await toggle.click();
    await expect(page.getByRole("button", { name: "2D Karte" })).toBeVisible();
    await expect(page.locator('canvas[aria-label^="Atlas-3D-Karte:"]')).toBeVisible();
    await expect(page.getByText("3D-Karte wird aufgebaut …")).toBeHidden({ timeout: 30_000 });
  });
});
