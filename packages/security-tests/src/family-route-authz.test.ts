/**
 * Jede Family-API-Route ist geschützt oder ausdrücklich als öffentlich erklärt.
 *
 * Family-Daten sind geteilt, aber nicht öffentlich: wer das Häkchen nicht hat,
 * darf keine Zeile sehen. Eine neue Route ohne Guard wäre genau der Fehler, den
 * dieser Test statisch verhindert — dasselbe Netz wie für Studio und Portal.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  assertFamilyRouteProtected,
  FAMILY_API_ROOT,
  FAMILY_AUTH_GUARD_PATTERN,
  FAMILY_PUBLIC_API_ALLOWLIST,
  listFamilyApiRouteFiles,
} from "./family-route-inventory";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(relativeRoute: string): string {
  return fs.readFileSync(path.join(repoRoot, FAMILY_API_ROOT, relativeRoute), "utf8");
}

describe("Family API route auth inventory", () => {
  const routes = listFamilyApiRouteFiles(repoRoot);

  it("findet die Family-API-Fläche", () => {
    assert.ok(routes.length > 0, "expected at least one Family API route");
  });

  it("öffentlich + geschützt decken die ganze Fläche ab", () => {
    const guarded = routes.filter((route) => !FAMILY_PUBLIC_API_ALLOWLIST.has(route));
    assert.equal(
      guarded.length + FAMILY_PUBLIC_API_ALLOWLIST.size,
      routes.length,
      "jede Family-Route muss geschützt oder allowlisted sein",
    );
  });

  for (const relativeRoute of routes) {
    it(`${relativeRoute} ist geschützt oder ausdrücklich öffentlich`, () => {
      assertFamilyRouteProtected(repoRoot, relativeRoute);
    });
  }

  it("die Allowlist bleibt tragend — kein toter Eintrag", () => {
    for (const relativeRoute of FAMILY_PUBLIC_API_ALLOWLIST) {
      assert.ok(
        routes.includes(relativeRoute),
        `Allowlisted Family-Route existiert nicht mehr: ${relativeRoute}`,
      );
      assert.ok(
        !FAMILY_AUTH_GUARD_PATTERN.test(readRoute(relativeRoute)),
        `${relativeRoute} hat jetzt einen Guard — aus FAMILY_PUBLIC_API_ALLOWLIST entfernen.`,
      );
    }
  });
});
