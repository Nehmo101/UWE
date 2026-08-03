import { expect, test } from "@playwright/test";
import { loginStudio } from "./helpers/auth";

/**
 * Die bewegte Bühne im Studio — und auf der Landing, die dieselbe App
 * ausliefert.
 *
 * Warum es diese Datei gibt: `portal-motion.spec.ts` prüfte die Bühne
 * ausschließlich im Portal. Sie war grün, während Studio überhaupt keine Szene
 * rendert hat — die studio-Clips wurden erzeugt, gebaut und ausgeliefert und
 * nie von einer Route angefragt. Ein Test, der nur einen von fünf Bereichen
 * kennt, deckt die Lücke nicht auf, um die es geht.
 *
 * Anders als im Portal trägt Studio die Szene als **Band** am oberen Rand der
 * Arbeitsfläche und nur auf den Einstiegen (`src/lib/studio-scene.ts`). Der
 * dritte Test hält genau diese Grenze fest: hinter einer Arbeitsfläche darf
 * kein Hintergrundvideo laufen.
 */

test("die Landing lädt ihren Clip", async ({ page }) => {
  // `/` ist die öffentliche Landing — ohne Anmeldung erreichbar und die
  // einzige Studio-Route mit der landing-Szene statt der studio-Szene.
  await page.goto("/");

  const video = page.locator("video").first();
  await expect(video).toBeAttached({ timeout: 15000 });

  const info = await video.evaluate(async (el: HTMLVideoElement) => {
    for (let i = 0; i < 60 && el.readyState < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { src: el.currentSrc, readyState: el.readyState, width: el.videoWidth };
  });

  expect(info.readyState, `keine Bilddaten geladen (${info.src})`).toBeGreaterThanOrEqual(2);
  expect(info.width, "Video ohne Bildgröße").toBeGreaterThan(0);
  expect(info.src).toContain("/scenes/motion/landing-");
});

test("die Welten-Übersicht trägt das Studio-Band", async ({ page }) => {
  await loginStudio(page);
  await page.goto("/worlds");

  const video = page.locator("video").first();
  await expect(video).toBeAttached({ timeout: 15000 });

  const info = await video.evaluate(async (el: HTMLVideoElement) => {
    for (let i = 0; i < 60 && el.readyState < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { src: el.currentSrc, readyState: el.readyState, loop: el.loop, muted: el.muted };
  });

  expect(info.readyState, `keine Bilddaten geladen (${info.src})`).toBeGreaterThanOrEqual(2);
  // Der springende Punkt: die **studio**-Szene, nicht die der Landing. Beide
  // Bereiche werden in diese App kopiert, eine Verwechslung fiele sonst nicht auf.
  expect(info.src).toContain("/scenes/motion/studio-");
  expect(info.loop).toBe(true);
  expect(info.muted).toBe(true);
});

test("hinter einer Arbeitsfläche läuft kein Video", async ({ page }) => {
  await loginStudio(page);
  // Genau der Fall, für den die Regel exakt und nicht als Präfix formuliert
  // ist: `/worlds` trägt die Bühne, die Wiki-Liste derselben Welt nicht.
  await page.goto("/worlds/terra/wiki");
  await expect(page).toHaveURL(/\/worlds\/terra\/wiki/);

  // `toHaveCount` wiederholt bis zum Timeout — ein spät nachgereichtes Video
  // ließe den Test also trotzdem kippen, statt still durchzugehen.
  await expect(page.locator("video")).toHaveCount(0, { timeout: 8000 });
});

test("bei abgeschalteter Bewegung wird gar kein Video geladen", async ({ page }) => {
  await loginStudio(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/worlds");

  const reduceActive = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduceActive, "reduced-motion wurde nicht emuliert").toBe(true);

  await expect(page.locator("video")).toHaveCount(0);
});
