import { expect, test } from "@playwright/test";
import { loginPortalPlayer } from "./helpers/auth";

/**
 * Die bewegte Bühne, geprüft dort wo sie tatsächlich rendert.
 *
 * Dass die Dateien im Ordner liegen, sagt nichts: `SceneStage` rendert nur,
 * wenn der `available`-Schalter in `sceneMotion.ts` steht, wenn der Bereich
 * eine Szene hat und wenn der Browser eines der beiden Formate mag. Diese
 * Prüfung geht den ganzen Weg — bis `readyState`, also bis wirklich Bilddaten
 * da sind.
 *
 * Der zweite Test ist der wichtigere: unter `prefers-reduced-motion` darf gar
 * kein Video geladen werden. Ein Hintergrundvideo ist genau die Art
 * Dauerbewegung, die diese Einstellung meint — und wer sie setzt, soll auch
 * nicht die Bytes bezahlen.
 */

test("die Bühne lädt und läuft", async ({ page }) => {
  await loginPortalPlayer(page);
  await page.goto("/auth/worlds/terra");
  await expect(page.getByRole("heading", { name: "Terra" }).first()).toBeVisible();

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
  expect(info.src).toContain("/scenes/motion/portal-");

  // Ohne `loop` bliebe nach 16 Sekunden ein Standbild stehen; ohne `muted`
  // verweigern Browser den Autostart.
  expect(info.loop).toBe(true);
  expect(info.muted).toBe(true);
  // Das Poster trägt die Fläche, bis das Video übernimmt — sonst blitzt beim
  // Laden der Seitenhintergrund durch.
  expect(info.hasPoster).toBe(true);
});

test("bei abgeschalteter Bewegung wird gar kein Video geladen", async ({ page }) => {
  await loginPortalPlayer(page);
  // Bewusst `emulateMedia` statt `test.use({ reducedMotion })`: die
  // Kontext-Option kam in diesem Aufbau nicht bis in die Seite durch
  // (`matchMedia` meldete weiterhin `no-preference`), und ein Test, der die
  // Bedingung gar nicht herstellt, prüft nichts.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/auth/worlds/terra");
  await expect(page.getByRole("heading", { name: "Terra" }).first()).toBeVisible();

  // Voraussetzung mitprüfen, sonst wäre ein grüner Test wertlos.
  const reduceActive = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  expect(reduceActive, "reduced-motion wurde nicht emuliert").toBe(true);

  // Kein `<video>` im Dokument: nicht pausiert, nicht versteckt — gar nicht
  // erst erzeugt, also auch keine Netzwerklast.
  await expect(page.locator("video")).toHaveCount(0);
});
