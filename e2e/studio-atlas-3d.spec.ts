import { expect, test } from "@playwright/test";

import { loginStudio } from "./helpers/auth";

test.describe("Studio Atlas 3D", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudio(page);
  });

  test("lazy-loads WebGL and keeps editor projection round-trippable", async ({ page }) => {
    await page.goto("/worlds/terra/atlas");
    const nodeLinks = page.locator('a[href^="/worlds/terra/atlas/"]');
    test.skip((await nodeLinks.count()) === 0, "Seed database has no Atlas node");
    await nodeLinks.first().click();

    const frame = page.frameLocator('iframe[title="UWE Atlas Editor"]');
    const toggle = frame.getByRole("button", { name: "3D Ansicht" });
    await expect(toggle).toBeVisible();
    const webgl = await frame.locator("#atlas-canvas-3d").evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webgl, "Chromium has no WebGL/SwiftShader context");

    await toggle.click();
    await expect(frame.getByRole("button", { name: "2D Ansicht" })).toBeVisible();
    await expect.poll(() => frame.locator("body").evaluate(() => Boolean(window.__atlas3dReady))).toBe(true);

    const roundTripError = await frame.locator("body").evaluate(() => {
      const debug = window.__atlasDebug;
      const projected = debug.worldNToScreen(0.5, 0.5);
      if (!projected) return Number.POSITIVE_INFINITY;
      const picked = debug.screenToWorldN(projected[0], projected[1]);
      return picked ? Math.hypot(picked[0] - 0.5, picked[1] - 0.5) : Number.POSITIVE_INFINITY;
    });
    expect(roundTripError).toBeLessThan(0.015);

    const before = await frame.locator("body").evaluate(() => window.__atlasDebug.doc.objects.length);
    await frame.getByRole("button", { name: /Objekt\/Bau/ }).click();
    await frame.locator("#atlas-canvas-3d").click({ position: { x: 500, y: 300 } });
    await expect.poll(() => frame.locator("body").evaluate(() => window.__atlasDebug.doc.objects.length)).toBe(before + 1);
  });
});

declare global {
  interface Window {
    __atlas3dReady?: boolean;
    __atlasDebug: {
      doc: { objects: unknown[] };
      worldNToScreen(x: number, y: number): [number, number] | null;
      screenToWorldN(x: number, y: number): [number, number] | null;
    };
  }
}
