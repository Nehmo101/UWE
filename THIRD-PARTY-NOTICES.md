# Third-Party Notices

Dieses Dokument hält fest, welche fremden Werke UWE berührt — als Referenz, als
Laufzeit-Abhängigkeit oder als Datenquelle. Es ersetzt keine Rechtsberatung.

## 1. Odysseus (AGPL-3.0-or-later)

- **Projekt:** [pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus)
- **Lizenz:** GNU Affero General Public License v3.0 or later
- **Sprache:** Python (FastAPI) + Vanilla-JS-Frontend
- **Rolle für UWE:** Produkt- und UX-Referenz während der Feature- und Theme-Arbeit
  (2026-06). **Kein Submodul, kein Vendor-Bundle, keine Abhängigkeit.**

### Was tatsächlich übernommen wurde

Ein maschineller Abgleich beider Codebases (Stand 2026-07-27) ergibt:

| Prüfung | Ergebnis |
|---|---|
| Identische Quelltextzeilen (≥ 45 Zeichen, normalisiert) | **15 von 118.694** — davon 13 generische Boilerplate (HTTP-Header, MIME-Typen, `viewport`-Meta, eslint-Direktiven, die kanonische RGB→HSL-Formel, das übliche `devicePixelRatio`-Idiom) |
| Identische String-Literale (≥ 20 Zeichen) | **57** — ausschließlich fremde API-Endpunkte (OpenAI, Anthropic, Ollama, Google), HTTP-Header, MIME-Typen, Standard-Ports und bekannte Test-URLs |
| Gemeinsame Farbwerte in den Theme-Paletten | **11 von 110** — sämtlich Tailwind-Standardfarben (`sky-400`, `green-400`, `slate-400`, `red-500`, `amber-500` …), die beide Projekte unabhängig verwenden |
| Gemeinsame seltene Bezeichner (≥ 14 Zeichen) | **171** — praktisch vollständig DOM-/Web-APIs, Standard-Env-Variablennamen und gebräuchliche Wörter |
| Gemeinsame Modell-IDs im Cookbook-Katalog | **17** — öffentliche Upstream-Modellnamen (`llama3.1`, `deepseek-r1`, `qwen2.5-coder` …), keine schutzfähige Auswahl |

**Zwei Fundstellen sind echte Übernahmen** und in
`packages/cookbook/src/diagnostics.ts` dokumentiert:

- `/No available memory for the cache blocks|Available KV cache memory:.*-/i`
- `/No CUDA GPUs are available|no GPU.*found/i`

Beide sind Suchmuster für **Fehlerausgaben fremder Werkzeuge** (llama.cpp, vLLM,
PyTorch). Sie beschreiben Tatsachen über das Verhalten dieser Programme, nicht die
schöpferische Ausdrucksform von Odysseus. Die umgebende Struktur
(`summary` + `suggestions[]`), sämtliche Meldungstexte und alle übrigen Muster
sind UWE-eigen.

**Bewertung:** Keine substanzielle Code-Übernahme. UWE steht nicht in einem
abgeleiteten Verhältnis zu Odysseus im Sinne der AGPL.

### Auf Konzeptebene übernommen (nicht schutzfähig)

Token-basierte Themes, Preset- plus Workspace-Themes, `localStorage`-Persistenz,
ein Inline-Bootstrap-Skript gegen Theme-Flash, Dichte-/Font-/Hintergrund-Optionen,
Frosted-Glass-Panels. Umgesetzt in `packages/shared-ui/src/theme/*` mit
UWE-eigenen IDs, Paletten und Implementierungen.

Frühe Entwürfe trugen Vorschau-IDs wie `odysseus-dark-inspired`. Diese sind nie
ausgeliefert worden; `LEGACY_THEME_ID_MAP` in `themes.ts` migriert gespeicherte
`localStorage`-Einträge auf die UWE-eigenen IDs.

### Regel für künftige Arbeit

1. Kein Copy-Paste aus Odysseus oder anderen AGPL-Projekten in UWE-Laufzeitcode.
2. UWE-eigene Benennung für Themes, Tokens, Komponenten und Beschriftungen.
3. Wirkt eine Farbe zu nah an einer Referenz, wird sie verschoben.
4. Review-Frage bei jedem PR: *Könnte dieser Diff nur existieren, weil jemand
   AGPL-Quelltext abgeschrieben hat?* Wenn ja: ablehnen.
5. Soll doch einmal Code übernommen werden, braucht es vorher eine bewusste
   Entscheidung — entweder die betroffenen Teile unter AGPL-3.0 stellen (mit
   Vermerken) oder eine gesonderte Lizenz der Rechteinhaber einholen.

## 2. D&D-Regelinhalte (SRD)

UWE bündelt **keine** Regelinhalte. Statblocks, Zauber und Ausrüstung werden zur
Laufzeit über öffentliche APIs geladen:

- [dnd5eapi.co](https://www.dnd5eapi.co/api) — SRD 5.1
- [open5e.com](https://api.open5e.com) — SRD und OGL-Inhalte

Die abgerufenen Inhalte unterliegen der **Open Game License 1.0a** bzw.
**CC-BY-4.0**, je nach Quelle. Wer UWE betreibt und SRD-Inhalte veröffentlicht,
ist für die zugehörigen Lizenzhinweise selbst verantwortlich. UWE selbst gibt
keine Regelinhalte weiter.

## 3. NPM-Abhängigkeiten

Alle Laufzeit- und Build-Abhängigkeiten stammen aus der öffentlichen
npm-Registry und behalten ihre jeweiligen Lizenzen. Der vollständige Baum steht
in `pnpm-lock.yaml`. `pnpm audit:prod` läuft als Teil des Quality Gates.

## 4. Bildmaterial in `assets/scenes/`

> **Offen — vor der Veröffentlichung zu klären.** Das Verzeichnis enthält rund
> 74 MB Szenen-Artwork ohne dokumentierte Herkunft. Vor dem Öffentlichstellen
> muss hier stehen, wie die Bilder entstanden sind (eigene Erstellung,
> KI-Generierung mit welchem Werkzeug, oder lizenziertes Fremdmaterial) und
> unter welchen Bedingungen Dritte sie weiterverwenden dürfen.
