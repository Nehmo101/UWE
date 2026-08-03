import { expect, test } from "@playwright/test";
import { loginFamily } from "./helpers/auth";

/**
 * Die bewegte Bühne in Family.
 *
 * Family war der krasseste Fall: `FamilyShell` konnte die Bühne von Anfang an,
 * aber **keine einzige** der 22 Seiten hat ihr je einen `sceneIndex` gegeben.
 * Die vier family-Clips wurden erzeugt, gebaut und nach
 * `apps/family/public/scenes/motion/` ausgeliefert, und kein Browser hat sie
 * je angefragt. Aufgefallen ist es nicht, weil Family im Playwright-Aufbau
 * gar nicht vorkam — den gibt es erst mit diesem Spec.
 */

test("die Startseite lädt ihren Clip", async ({ page }) => {
  await loginFamily(page);
  await page.goto("/");

  const video = page.locator("video").first();
  await expect(video).toBeAttached({ timeout: 15000 });

  const info = await video.evaluate(async (el: HTMLVideoElement) => {
    for (let i = 0; i < 60 && el.readyState < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
      src: el.currentSrc,
      readyState: el.readyState,
      width: el.videoWidth,
      loop: el.loop,
      muted: el.muted,
      hasPoster: el.poster.length > 0,
    };
  });

  expect(info.readyState, `keine Bilddaten geladen (${info.src})`).toBeGreaterThanOrEqual(2);
  expect(info.width, "Video ohne Bildgröße").toBeGreaterThan(0);
  // Family hat seit dem v3-Redesign einen eigenen Pool. Liefe hier ein
  // brain-Clip, wäre der Redesign-Schritt stillschweigend zurückgedreht.
  expect(info.src).toContain("/scenes/motion/family-");
  expect(info.loop).toBe(true);
  expect(info.muted).toBe(true);
  expect(info.hasPoster).toBe(true);
});

test("hinter der Küche läuft kein Video", async ({ page }) => {
  await loginFamily(page);
  await page.goto("/kitchen");
  await expect(page).toHaveURL(/\/kitchen/);

  await expect(page.locator("video")).toHaveCount(0, { timeout: 8000 });
});

test("bei abgeschalteter Bewegung wird gar kein Video geladen", async ({ page }) => {
  await loginFamily(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const reduceActive = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduceActive, "reduced-motion wurde nicht emuliert").toBe(true);

  await expect(page.locator("video")).toHaveCount(0);
});
