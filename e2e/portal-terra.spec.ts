import { expect, test } from "@playwright/test";

import { loginPortalPlayer } from "./helpers/auth";

/**
 * Terra im Portal — Karten für Spieler, im Lesemodus.
 *
 * Ersatz für `e2e/portal-atlas3d.spec.ts`. Die eine Sache, die hier zählt und
 * die kein Unit-Test zeigen kann: Der Portal-Rahmen ist EINSEITIG. Er lädt die
 * Karte hinein und nimmt danach nichts mehr entgegen — im Portal existiert
 * keine Server Action zum Schreiben. Die Absicherung ist das fehlende
 * Gegenüber, nicht ein Flag im Frame; deshalb wird hier auf die ABWESENHEIT
 * der Schreib-Bedienelemente geprüft, nicht auf ein deaktiviertes Aussehen.
 *
 * Zugriff hängt allein an der Weltmitgliedschaft, nie an der einzelnen Karte
 * (Owner-Entscheid 2026-07-21, unverändert für Terra übernommen).
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

  test("die Kartenansicht hat keinen Schreibweg", async ({ page }) => {
    await page.goto(LISTE);

    const eintraege = page.getByTestId("terra-portal-liste").getByRole("link");
    const anzahl = await eintraege.count();
    test.skip(
      anzahl === 0,
      "Keine Karte in der e2e-Datenbank — das Portal kann keine anlegen (kein Schreibweg), " +
        "und der Seed legt keine an. Der Fall wird abgedeckt, sobald studio-terra.spec.ts " +
        "im selben Lauf eine Karte erzeugt hat.",
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

    // Die Sicherung: nichts, was im Studio schreibt, existiert hier.
    await expect(page.getByTestId("terra-zustand")).toHaveCount(0);
    await expect(page.getByTestId("terra-entwurf-prompt")).toHaveCount(0);
    await expect(page.getByTestId("terra-text-prompt")).toHaveCount(0);
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
  });
});
