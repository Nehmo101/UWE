import { expect, test } from "@playwright/test";
import { loginBrain } from "./helpers/auth";

/**
 * Die bewegte Bühne im Brain.
 *
 * Vor diesem Spec gab es für Brain gar keinen Browser-Test — die App war im
 * Playwright-Aufbau nicht vorhanden. Genau deshalb konnte `/today` jahrelang
 * die einzige Fläche mit Bühne bleiben, während der Rest der App die vier
 * brain-Clips ausgeliefert bekam und nie abrief.
 *
 * Brain rendert die Szene über `SceneHero`, und `BrainShell` zeigt ihn nur,
 * wenn die Seite einen `sceneIndex` übergibt. Der zweite Test hält fest, dass
 * das eine bewusste Grenze ist und kein Zufall: Arbeitsseiten bleiben ruhig.
 */

test("die Startseite lädt ihren Clip", async ({ page }) => {
  await loginBrain(page);
  await page.goto("/");

  const video = page.locator("video").first();
  await expect(video).toBeAttached({ timeout: 15000 });

  const info = await video.evaluate(async (el: HTMLVideoElement) => {
    // readyState >= 2 heißt: Bilddaten für die aktuelle Position sind da.
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
  // Der eigene Pool, nicht der von Family: die beiden liefen vor dem
  // v3-Redesign auf denselben Motiven und sahen dadurch gleich aus.
  expect(info.src).toContain("/scenes/motion/brain-");
  expect(info.loop).toBe(true);
  expect(info.muted).toBe(true);
  expect(info.hasPoster).toBe(true);
});

test("auch Heute trägt die Bühne", async ({ page }) => {
  await loginBrain(page);
  await page.goto("/today");

  const video = page.locator("video").first();
  await expect(video).toBeAttached({ timeout: 15000 });
  expect(await video.evaluate((el: HTMLVideoElement) => el.currentSrc)).toContain(
    "/scenes/motion/brain-",
  );
});

test("hinter einer Arbeitsseite läuft kein Video", async ({ page }) => {
  await loginBrain(page);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/projects/);

  await expect(page.locator("video")).toHaveCount(0, { timeout: 8000 });
});

test("bei abgeschalteter Bewegung wird gar kein Video geladen", async ({ page }) => {
  await loginBrain(page);
  // Bewusst `emulateMedia` statt `test.use({ reducedMotion })` — die
  // Kontext-Option kam in diesem Aufbau nicht bis in die Seite durch.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const reduceActive = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduceActive, "reduced-motion wurde nicht emuliert").toBe(true);

  await expect(page.locator("video")).toHaveCount(0);
});
