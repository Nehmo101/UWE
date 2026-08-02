import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveShellBreadcrumb } from "./derive-breadcrumb";

const TERRA = { slug: "terra", name: "Terra" };

describe("abgeleitete Brotkrumen", () => {
  it("führt Welt-Bereichsseiten über Welten und Weltname", () => {
    assert.deepEqual(deriveShellBreadcrumb("/worlds/terra/sessions", TERRA), [
      { label: "Welten", href: "/worlds" },
      { label: "Terra", href: "/worlds/terra/dashboard" },
      { label: "Sessions" },
    ]);
  });

  it("nimmt den spezifischsten Nav-Treffer, nicht den kürzesten", () => {
    const trail = deriveShellBreadcrumb("/worlds/terra/pages/new", TERRA);
    assert.equal(trail.at(-1)?.label, "Neue Seite");
  });

  it("wiederholt die Welt auf ihrem Dashboard nicht", () => {
    assert.deepEqual(deriveShellBreadcrumb("/worlds/terra/dashboard", TERRA), [
      { label: "Welten", href: "/worlds" },
      { label: "Terra", href: "/worlds/terra/dashboard" },
    ]);
  });

  it("hängt die gemerkte Welt nicht an globale Routen", () => {
    assert.deepEqual(deriveShellBreadcrumb("/search", TERRA), [{ label: "Suche" }]);
    assert.deepEqual(deriveShellBreadcrumb("/jobs", TERRA), [{ label: "Hintergrund-Jobs" }]);
  });

  it("verlinkt die Weltenliste nicht auf sich selbst", () => {
    assert.deepEqual(deriveShellBreadcrumb("/worlds", TERRA), [{ label: "Welten" }]);
  });

  it("bleibt leer, wenn die IA den Pfad nicht kennt", () => {
    assert.deepEqual(deriveShellBreadcrumb("/gibt-es-nicht", null), []);
  });

  it("fällt ohne auflösbare Welt auf den Welten-Eintrag zurück", () => {
    // Kann der Shell die Welt nicht auflösen (gelöscht, kaputte URL), bleibt
    // die Weltenliste als Ausweg stehen — besser als eine leere Topbar.
    assert.deepEqual(deriveShellBreadcrumb("/worlds/terra/wiki", null), [
      { label: "Alle Welten" },
    ]);
  });
});
