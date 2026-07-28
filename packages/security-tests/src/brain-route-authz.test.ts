/**
 * Jede Brain-API-Route ist geschützt oder ausdrücklich als öffentlich erklärt.
 *
 * Brain ist der privateste Bereich von UWE — Personal Brain, Daily Admin und
 * seit H10 das Postfach. Bis dahin hatte Brain als einzige App keine
 * Routen-Inventur; mit 22 Mail-Routen auf einen Schlag wäre eine vergessene
 * Guard-Zeile teuer geworden. Dasselbe Netz wie für Studio, Portal und Family.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertBrainRouteProtected,
  BRAIN_API_ROOT,
  BRAIN_AUTH_GUARD_PATTERN,
  BRAIN_PUBLIC_API_ALLOWLIST,
  listBrainApiRouteFiles,
} from "./brain-route-inventory";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, BRAIN_API_ROOT, relativeRoute), "utf8");
}

describe("Brain API route auth inventory", () => {
  const routes = listBrainApiRouteFiles(repoRoot);

  it("findet die Brain-API-Fläche", () => {
    assert.ok(routes.length > 0, "expected at least one Brain API route");
  });

  it("öffentlich + geschützt decken die ganze Fläche ab", () => {
    const guarded = routes.filter((route) => !BRAIN_PUBLIC_API_ALLOWLIST.has(route));
    assert.equal(
      guarded.length + BRAIN_PUBLIC_API_ALLOWLIST.size,
      routes.length,
      "jede Brain-Route muss geschützt oder allowlisted sein",
    );
  });

  for (const relativeRoute of routes) {
    it(`${relativeRoute} ist geschützt oder ausdrücklich öffentlich`, () => {
      assertBrainRouteProtected(repoRoot, relativeRoute);
    });
  }

  it("die Allowlist bleibt tragend — kein toter Eintrag", () => {
    for (const relativeRoute of BRAIN_PUBLIC_API_ALLOWLIST) {
      assert.ok(
        routes.includes(relativeRoute),
        `Allowlisted Brain-Route existiert nicht mehr: ${relativeRoute}`,
      );
      assert.ok(
        !BRAIN_AUTH_GUARD_PATTERN.test(readRoute(relativeRoute)),
        `${relativeRoute} hat jetzt einen Guard — aus BRAIN_PUBLIC_API_ALLOWLIST entfernen.`,
      );
    }
  });
});

describe("Brain-Mail-Mutationen prüfen die Herkunft", () => {
  const routes = listBrainApiRouteFiles(repoRoot).filter((route) => route.startsWith("mail/"));

  it("findet die Mail-Fläche", () => {
    assert.ok(routes.length >= 15, `erwartet wurden die Mail-Routen, gefunden: ${routes.length}`);
  });

  /**
   * Der eigentliche Punkt: eine schreibende Mail-Route darf nicht am
   * Lese-Guard hängen. `requireBrainMailApi` prüft nur das Häkchen —
   * Same-Origin und Rate-Limit stecken in `requireBrainMailMutation`. Wer beim
   * Anlegen einer Route die falsche Hälfte erwischt, macht das Postfach für
   * jede Seite erreichbar, die der angemeldete Owner nebenbei offen hat.
   */
  for (const relativeRoute of routes) {
    const source = readRoute(relativeRoute);
    const mutatingHandlers = ["POST", "PATCH", "PUT", "DELETE"].filter((method) =>
      new RegExp(`export async function ${method}\\b`).test(source),
    );
    if (mutatingHandlers.length === 0) continue;

    it(`${relativeRoute} (${mutatingHandlers.join(", ")}) nutzt den Mutations-Guard`, () => {
      assert.match(
        source,
        /requireBrainMailMutation/,
        `${relativeRoute} schreibt, prüft aber nicht die Herkunft — requireBrainMailMutation verwenden.`,
      );
    });
  }
});
