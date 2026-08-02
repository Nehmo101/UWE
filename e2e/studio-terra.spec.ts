import { expect, test } from "@playwright/test";

import { loginStudio } from "./helpers/auth";

/**
 * Terra im Studio — Kartenliste, Karte im Rahmen, Rechteprüfung.
 *
 * Ersatz für `e2e/studio-atlas3d.spec.ts`, das mit dem Atlas-Abbau gelöscht
 * wurde. Die Vorlage war stillgelegt (`describe.skip`) und trug im Kopf die
 * Prüfliste, die ein Terra-Spec beerben sollte: bootstrapt der Einstieg, hängt
 * der Editor im Rahmen, greifen die Guards.
 *
 * Bewusst NICHT geprüft — und das ist kein Versehen:
 *
 *   - Was IM Frame passiert. Terra ist gleich-origin ausgeliefertes statisches
 *     HTML mit WebGL; ein Klick auf sein Canvas prüft die Grafikkarte des
 *     Runners, nicht UWE. Der Atlas-Vorgänger hat genau daran gehangen und
 *     musste seine Fälle mit `test.skip(!webgl)` selbst wieder abschalten.
 *     Terras Innenleben hat eigene Tests unter `terra/test/`.
 *   - Ob `/terra/index.html` Inhalt liefert. Die Datei entsteht erst durch
 *     `scripts/copy-terra.mjs`, das an `predev`/`prebuild` der App hängt —
 *     `scripts/e2e-servers.mjs` ruft `next build` aber direkt auf und geht
 *     daran vorbei. Geprüft wird deshalb, dass der Rahmen mit der richtigen
 *     Quelle DA ist, nicht was er zeigt.
 *
 * Geprüft wird die Naht zwischen UWE und Terra: Liste, Anlegen, Rahmen,
 * Mandantengrenze, Anmeldezwang. Genau das, was der Frame nicht selbst kann.
 */

const WELT = "terra";
const LISTE = `/worlds/${WELT}/karten`;

test.describe("Studio Terra — Kartenliste", () => {
  test.beforeEach(async ({ page }) => {
    await loginStudio(page);
  });

  test("zeigt die Kartenübersicht, ohne beim Hinsehen etwas anzulegen", async ({ page }) => {
    /* Der Atlas legte beim bloßen Aufruf seiner Indexseite eine Welt in der
       Datenbank an (`getOrCreateForWorld` + redirect) — deshalb standen dort
       Zeilen, die niemand gebaut hatte. Terras Liste tut das nicht: Der GET
       bleibt auf seiner URL stehen und leitet nirgendwohin weiter. */
    await page.goto(LISTE);

    await expect(page).toHaveURL(new RegExp(`${LISTE}$`));
    await expect(page.getByRole("heading", { name: "Karten", exact: true })).toBeVisible();
    await expect(page.getByTestId("terra-karte-anlegen")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Brotkrumen" })).toContainText("Karten");
  });

  test("legt eine Karte an und öffnet sie im Rahmen", async ({ page }) => {
    await page.goto(LISTE);
    await page.getByTestId("terra-karte-anlegen").click();

    /* Angelegt wird nur auf Klick — und dann geht es direkt in den Editor.
       Grosszuegiges Zeitfenster: dazwischen liegen eine Server Action mit
       Schreibzugriff, ein `revalidatePath` und eine Client-Navigation; die
       Vorgabe von 5 s reicht auf einem ausgelasteten Rechner nicht zuverlaessig. */
    await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"), { timeout: 20_000 });

    const rahmen = page.getByTestId("terra-rahmen");
    await expect(rahmen).toBeVisible();
    await expect(rahmen).toHaveAttribute("src", /\/terra\/index\.html/);
    /* Gleich-origin und bewusst ohne `sandbox`: Terra braucht localStorage
       (Autosave-Ring). Ein `sandbox` ohne allow-same-origin nähme ihm genau
       das — und eines MIT allow-same-origin plus allow-scripts hebt sich
       selbst auf. Die Absicherung ist, dass der Frame keine Route und keine
       Sitzung besitzt, nicht das Attribut. */
    expect(await rahmen.getAttribute("sandbox")).toBeNull();

    // Der Speicherzustand ist die einzige Anzeige, die dem Rahmen gehört.
    await expect(page.getByTestId("terra-zustand")).toBeVisible();

    // Beide KI-Bedienfelder hängen an der Seite, nicht am Frame.
    await expect(page.getByTestId("terra-entwurf-prompt")).toBeVisible();
    await expect(page.getByTestId("terra-text-prompt")).toBeVisible();
    await expect(page.getByTestId("terra-text-aktion")).toBeVisible();

    // Zurück über die Brotkrumen: die neue Karte steht in der Liste.
    await page.getByRole("navigation", { name: "Brotkrumen" }).getByRole("link", { name: "Karten" }).click();
    await expect(page).toHaveURL(new RegExp(`${LISTE}$`));
    await expect(page.getByTestId("terra-karten-liste")).toBeVisible();
  });

  test("die beiden Kartentext-Aktionen sind wählbar", async ({ page }) => {
    /* `terra_name_regions` und `terra_describe_region` sind die zwei
       überlebenden der vier verwaisten Atlas-Brain-Aktionen. Sie hatten seit
       dem Atlas-Abbau keinen Aufrufer mehr; dass sie wieder einen haben, ist
       genau das, was hier steht. Der Lauf selbst wird NICHT ausgelöst — er
       braucht ein lokales Modell, das auf keinem Runner läuft. */
    await page.goto(LISTE);

    /* Eine vorhandene Karte öffnen statt eine zweite anzulegen. Nicht aus
       Bequemlichkeit: jede Server Action baut sich über `createPrismaClient()`
       eine eigene Verbindung zur SQLite-Datei auf, und zwei Anlegen-Vorgänge
       kurz hintereinander blockieren sich dort gemessen (28.07.2026)
       gelegentlich bis über 20 s. Das gehört untersucht — aber es ist nicht
       das, was dieser Fall zeigen soll. */
    const eintraege = page.getByTestId("terra-karten-liste").getByRole("link");
    if ((await eintraege.count()) === 0) {
      await page.getByTestId("terra-karte-anlegen").click();
      await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"), { timeout: 20_000 });
    } else {
      const ziel = await eintraege.first().getAttribute("href");
      await page.goto(ziel!);
    }
    await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"));

    const auswahl = page.getByTestId("terra-text-aktion");
    await expect(auswahl.locator("option")).toHaveCount(2);
    await expect(page.getByTestId("terra-text-holen")).toBeDisabled();

    await page.getByTestId("terra-text-prompt").fill("Wald im Norden, Bucht im Südwesten");
    await expect(page.getByTestId("terra-text-holen")).toBeEnabled();
  });

  test("ein Ort-Wiki lässt sich als Grundlage der Vorgenerierung übergeben", async ({ page }) => {
    /* Der Lauf wird auch hier NICHT ausgelöst — er braucht ein lokales Modell.
       Geprüft wird die Kette davor, und die ist die eigentliche Naht: die
       Seite lädt die Ort-Wikis der Welt, das Auswahlfeld zeigt sie gruppiert,
       und eine Wahl schreibt die Vorlage ins Prompt-Feld. Was der Slug im
       Kontext des Laufs anrichtet, prüft `ort-quelle.test.ts` und der
       Kontextbau — nicht der Browser. */
    await page.goto(LISTE);

    const eintraege = page.getByTestId("terra-karten-liste").getByRole("link");
    if ((await eintraege.count()) === 0) {
      await page.getByTestId("terra-karte-anlegen").click();
      await expect(page).toHaveURL(new RegExp(`${LISTE}/[a-z0-9]+`, "i"), { timeout: 20_000 });
    } else {
      const ziel = await eintraege.first().getAttribute("href");
      await page.goto(ziel!);
    }

    const ortwahl = page.getByTestId("terra-ort-wahl");
    await expect(ortwahl).toBeVisible();

    // Die Seed-Welt hat Ort-Wikis; „— ohne Wiki-Seite —" steht zusätzlich da.
    const werte = await ortwahl.locator("option").evaluateAll((optionen) =>
      optionen.map((o) => (o as HTMLOptionElement).value),
    );
    expect(werte[0]).toBe("");
    expect(werte.length).toBeGreaterThan(1);

    const prompt = page.getByTestId("terra-entwurf-prompt");
    await expect(prompt).toHaveValue("");

    await ortwahl.selectOption(werte[1]);
    await expect(page.getByTestId("terra-ort-hinweis")).toBeVisible();
    await expect(prompt).toHaveValue(/Ort aus dem Wiki dieser Welt/);
    await expect(prompt).toHaveValue(/Was im Wiki steht, gilt/);

    /* Die Vorlage überschreibt nur sich selbst: ein eigener Text übersteht den
       nächsten Griff ins Auswahlfeld. */
    await prompt.fill("Selbst getippt: raue Küste im Winter");
    await ortwahl.selectOption("");
    await expect(prompt).toHaveValue("Selbst getippt: raue Küste im Winter");
    await expect(page.getByTestId("terra-ort-hinweis")).toHaveCount(0);
  });
});

test.describe("Studio Terra — Rechteprüfung", () => {
  test("ohne Anmeldung führt die Kartenliste auf /login", async ({ page }) => {
    await page.goto(LISTE);
    await expect(page).toHaveURL(/\/login/);
  });

  test("ohne Anmeldung führt auch eine einzelne Karte auf /login", async ({ page }) => {
    await page.goto(`${LISTE}/beliebige-id`);
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * Beide Fälle prüfen die ANGEZEIGTE Seite, nicht den Status-Code.
   *
   * Gemessen am 28.07.2026: die Antwort trägt **200**, nicht 404. `WorldShell`
   * und die Layouts sind bereits gestreamt, wenn die Seite `notFound()` ruft —
   * danach kann Next den Status im Kopf nicht mehr ändern und liefert nur noch
   * die Not-Found-UI im Rumpf nach. Die Sperre wirkt (keine Kartenliste, keine
   * Karte), aber wer hier auf 404 prüft, prüft etwas, das dieses Framework auf
   * diesem Weg nicht liefern kann. Deshalb steht die Zahl hier nicht.
   */
  test("eine fremde Karten-Id ist nicht auffindbar, statt ihre Existenz zu verraten", async ({
    page,
  }) => {
    /* `holeInWelt(worldSlug, karteId)` schreibt die `worldId` in das `where`.
       Eine Id, die es nicht gibt, und eine Id aus einer fremden Welt sind von
       außen ununterscheidbar — beide liefern `null` und damit `notFound()`.
       Genau das ist der Sinn: eine 403 wäre eine Auskunft. */
    await loginStudio(page);
    await page.goto(`${LISTE}/gibtesnicht123`);

    await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
    await expect(page.getByTestId("terra-rahmen")).toHaveCount(0);
  });

  test("eine unbekannte Welt zeigt keine Kartenliste einer anderen", async ({ page }) => {
    await loginStudio(page);
    await page.goto("/worlds/gibtesnicht/karten");

    await expect(page.getByText("Seite nicht gefunden")).toBeVisible();
    await expect(page.getByTestId("terra-karten-liste")).toHaveCount(0);
    await expect(page.getByTestId("terra-karte-anlegen")).toHaveCount(0);
  });
});
