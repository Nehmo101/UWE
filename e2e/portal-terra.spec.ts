import { expect, test } from "@playwright/test";

import { loginPortalPlayer } from "./helpers/auth";

/**
 * Terra im Portal — Spieler bauen Karten, der Spielleiter nimmt sie ab (J5).
 *
 * WAS SICH GEGENÜBER J1 GEÄNDERT HAT, und warum dieser Kopf umgeschrieben ist:
 * Bis J5 war der Portal-Rahmen einseitig, und die Prüfung hier war die
 * ABWESENHEIT jedes Schreibwegs — es gab im Portal keine Server Action zum
 * Schreiben, also auch kein Ziel für einen manipulierten Frame. Seit J5 gibt
 * es dieses Ziel, für genau einen Fall: den eigenen, noch nicht abgenommenen
 * Entwurf.
 *
 * Die Zusage ist damit nicht mehr „nichts schreibt", sondern die schärfere:
 * DER LESEWEG UND DER SCHREIBWEG SIND ZWEI VERSCHIEDENE KOMPONENTEN, und die
 * Seite entscheidet auf dem Server, welche sie einsetzt. Deshalb prüft dieser
 * Test beide Richtungen:
 *
 *   - an einer abgenommenen Karte steht der Leserahmen und KEIN Zustandsfeld
 *     (`terra-spieler-zustand`) — dort schreibt weiterhin nichts;
 *   - am eigenen frischen Entwurf steht der Editor, und der Zustand meldet
 *     sich.
 *
 * Zugriff auf abgenommene Karten hängt weiterhin allein an der
 * Weltmitgliedschaft, nie an der einzelnen Karte (Owner-Entscheid
 * 2026-07-21).
 */

const WELT = "terra";
const LISTE = `/auth/worlds/${WELT}/karten`;
const PORTAL = process.env.E2E_PORTAL_URL ?? "http://127.0.0.1:3200";

test.describe("Portal Terra — Kartenliste", () => {
  test.use({ baseURL: PORTAL });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("ein Spieler sieht die Karten seiner Welt", async ({ page }) => {
    await page.goto(LISTE);

    await expect(page.getByRole("heading", { name: "Karten" })).toBeVisible();
    /* Leer oder gefüllt — beides ist ein gültiger Zustand der geteilten
       e2e-Datenbank. Geprüft wird, dass die Seite überhaupt entscheidet.
       `.first()`, weil `.or()` im strict mode denselben Knoten unter zwei
       Locator-Beschreibungen als zwei Treffer meldet. */
    const leer = page.getByTestId("terra-portal-leer");
    const liste = page.getByTestId("terra-portal-liste");
    await expect(leer.or(liste).first()).toBeVisible();
  });

  test("eine abgenommene Karte hat keinen Schreibweg", async ({ page }) => {
    await page.goto(LISTE);

    const eintraege = page.getByTestId("terra-portal-liste").getByRole("link");
    const anzahl = await eintraege.count();
    test.skip(
      anzahl === 0,
      "Keine abgenommene Karte in der e2e-Datenbank — der Seed legt keine an. " +
        "Der Fall wird abgedeckt, sobald studio-terra.spec.ts im selben Lauf eine erzeugt hat.",
    );

    /* Direkt auf die Adresse statt auf den Link klicken: geprüft wird die
       Leseansicht, nicht Next.js' Client-Navigation — und ein Klick vor der
       Hydration lässt die Seite still stehen. */
    const ziel = await eintraege.first().getAttribute("href");
    expect(ziel).toMatch(new RegExp(`${LISTE}/[a-z0-9]+`, "i"));
    await page.goto(ziel!);

    const rahmen = page.getByTestId("terra-leserahmen");
    await expect(rahmen).toBeVisible();
    // `?modus=lesen` blendet Werkzeuge im Frame aus. Komfort, nicht Sicherung.
    await expect(rahmen).toHaveAttribute("src", /\/terra\/index\.html\?modus=lesen/);

    // Die Sicherung: an einer abgenommenen Karte existiert kein Schreibweg.
    // Weder der Editorrahmen noch die Aktionen des Autors sind da.
    await expect(page.getByTestId("terra-spieler-rahmen")).toHaveCount(0);
    await expect(page.getByTestId("terra-spieler-zustand")).toHaveCount(0);
    await expect(page.getByTestId("terra-portal-einreichen")).toHaveCount(0);
    await expect(page.getByTestId("terra-portal-loeschen")).toHaveCount(0);
    // Und die Studio-eigenen Bedienfelder erst recht nicht.
    await expect(page.getByTestId("terra-entwurf-prompt")).toHaveCount(0);
    await expect(page.getByTestId("terra-text-prompt")).toHaveCount(0);
  });
});

test.describe("Portal Terra — eigener Entwurf", () => {
  test.use({ baseURL: PORTAL });

  test.beforeEach(async ({ page }) => {
    await loginPortalPlayer(page);
  });

  test("ein Spieler legt eine Karte an, bearbeitet sie und reicht sie ein", async ({ page }) => {
    await page.goto(LISTE);

    const anlegen = page.getByTestId("terra-portal-karte-anlegen");
    await expect(anlegen).toBeVisible();

    const titel = `E2E Entwurf ${Date.now()}`;
    await page.getByLabel("Titel der neuen Karte").fill(titel);
    await anlegen.click();

    // Die Action leitet in den Editor um — das ist der Beleg, dass sie
    // durchgelaufen ist und nicht an einem Guard hängengeblieben.
    await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"));
    await expect(page.getByRole("heading", { name: titel })).toBeVisible();

    // Der volle Editor, NICHT der Lesemodus: kein `?modus=lesen` in der Quelle.
    const rahmen = page.getByTestId("terra-spieler-rahmen");
    await expect(rahmen).toBeVisible();
    await expect(rahmen).toHaveAttribute("src", /\/terra\/index\.html$/);
    await expect(page.getByTestId("terra-leserahmen")).toHaveCount(0);
    await expect(page.getByTestId("terra-spieler-zustand")).toBeVisible();

    const entwurfUrl = page.url();

    // Einreichen sperrt die Bearbeitung: der Editor weicht dem Leserahmen.
    await page.getByTestId("terra-portal-einreichen").click();
    await expect(page.getByTestId("terra-leserahmen")).toBeVisible();
    await expect(page.getByTestId("terra-spieler-rahmen")).toHaveCount(0);

    // Zurückziehen gibt sie wieder frei.
    await page.getByTestId("terra-portal-zurueckziehen").click();
    await expect(page.getByTestId("terra-spieler-rahmen")).toBeVisible();

    // Aufräumen: der eigene Entwurf lässt sich löschen, und danach führt die
    // Adresse ins Leere — genau wie eine fremde Karte.
    await page.getByTestId("terra-portal-loeschen").click();
    await expect(page).toHaveURL(new RegExp(`${LISTE}$`));
    await page.goto(entwurfUrl);
    await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
  });

  test("der eigene Entwurf steht in einem eigenen Abschnitt, nicht bei den Weltkarten", async ({ page }) => {
    await page.goto(LISTE);

    const titel = `E2E Abschnitt ${Date.now()}`;
    await page.getByLabel("Titel der neuen Karte").fill(titel);
    await page.getByTestId("terra-portal-karte-anlegen").click();
    await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"));

    await page.goto(LISTE);
    await expect(page.getByTestId("terra-portal-entwuerfe").getByText(titel)).toBeVisible();
    await expect(page.getByTestId("terra-portal-liste").getByText(titel)).toHaveCount(0);

    await page.getByTestId("terra-portal-entwuerfe").getByText(titel).click();
    await page.getByTestId("terra-portal-loeschen").click();
    await expect(page).toHaveURL(new RegExp(`${LISTE}$`));
  });
});

test.describe("Portal Terra — Rechteprüfung", () => {
  test.use({ baseURL: PORTAL });

  test("ohne Anmeldung führt die Kartenliste auf /login", async ({ page }) => {
    await page.goto(LISTE);
    await expect(page).toHaveURL(/\/login/);
  });

  test("ohne Anmeldung führt auch eine einzelne Karte auf /login", async ({ page }) => {
    await page.goto(`${LISTE}/beliebige-id`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("eine Welt ohne Mitgliedschaft ist nicht auffindbar", async ({ page }) => {
    /* `getAccessContextForWorld` liefert null und die Seite ruft `notFound()`.
       Keine 403: dass es die Welt gibt, wäre selbst schon eine Auskunft.

       Geprüft wird die ANGEZEIGTE Seite, nicht der Status-Code. Gemessen
       (28.07.2026): die Antwort trägt 200, nicht 404 — `PortalShell` aus
       `layout.tsx` ist schon gestreamt, wenn die Seite `notFound()` ruft, und
       Next kann den Status danach nicht mehr ändern. Die Sperre wirkt (es gibt
       keine Kartenliste), die Zahl im Kopf ist nur nicht mehr korrigierbar. */
    await loginPortalPlayer(page);
    await page.goto("/auth/worlds/gibtesnicht/karten");

    await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
    await expect(page.getByTestId("terra-portal-liste")).toHaveCount(0);
    await expect(page.getByTestId("terra-portal-leer")).toHaveCount(0);
    // Und der Schreibweg ist dort erst recht nicht da.
    await expect(page.getByTestId("terra-portal-karte-anlegen")).toHaveCount(0);
  });
});
