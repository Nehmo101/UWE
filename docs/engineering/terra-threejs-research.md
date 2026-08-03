# Terra: kostenlose Three.js-MCPs und Design-Werkzeuge

Stand: 3. August 2026. Bewertet wurde gegen Terras tatsächlichen Aufbau:
Three.js ohne Bundler, prozedurale `BufferGeometry`, Canvas-Texturen, statische
Merges und die vorhandene Composer/Bloom-Pipeline. „Kostenlos“ bedeutet hier
Open Source und lokal betreibbar; Rechenzeit oder optionale Modell-APIs können
trotzdem Kosten verursachen.

## Ergebnis in Kürze

Es gibt derzeit keinen ausgereiften MCP, der Terras Art Direction automatisch
„schön macht“. Der größte Hebel ist eine **Werkzeugkette**: Blender MCP für
gezielte Hero-Assets, Chrome DevTools oder Playwright MCP für messbare
Bildvergleiche und glTF Transform für die Auslieferung. Shader- und
Postprocessing-Bibliotheken sollten erst nach einem visuellen Budget-Test in
die bewusst kleine Runtime übernommen werden.

## MCPs

| Werkzeug | Lizenz / Kosten | Nutzen für Terra | Urteil |
| --- | --- | --- | --- |
| [Blender MCP](https://github.com/ahujasid/blender-mcp) | MIT, lokal | Modellierung, Materialaufbau und Szenenänderungen über Blender; besonders passend für Schildkrötenkopf, Schloss-Silhouetten und kontrollierte glTF-Exporte. | **Pilotieren.** Nicht zur Laufzeit einbauen, sondern als Asset-Pipeline. Exporte müssen trianguliert, komprimiert und visuell gegen die prozeduralen Assets geprüft werden. |
| [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) | Apache-2.0, lokal | Browser-Screenshots, Performance- und Netzwerkdiagnose direkt in Chromium. Passt zum offenen Terra-Problem „wenige FPS trotz kleiner Szene“. | **Sofort sinnvoll.** Erst GPU/Frame-Aufteilung messen, dann Effekte ergänzen. |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Apache-2.0, lokal | Reproduzierbare Kamerapositionen, Bedienflüsse und Screenshot-Abzüge. | **Sofort sinnvoll.** Für die bestehenden Browser-Schauen und feste Seed-/Kameraverträge; Pixeltests tolerant statt bitgenau gestalten. |
| [Context7](https://github.com/upstash/context7) | MIT, Server lokal möglich | Aktuelle, versionsbezogene Bibliotheksdokumentation im Agentenkontext. | **Hilfreich, aber kein Grafik-Upgrade.** Auf Terras gepinnte Three-Version begrenzen, damit keine APIs aus einer neueren Revision erfunden werden. |

### MCP-Sicherheitsgrenze

Blender- und Browser-MCPs können lokale Programme steuern. Deshalb nur im
Entwicklungsprofil aktivieren, Arbeitsverzeichnisse einschränken, keine
Produktions-Secrets in den MCP-Prozess geben und generierte Assets wie normalen
Fremdcode prüfen. Ein MCP gehört **nicht** in Terras Browser-Import-Map.

## Kostenlose Plugins und Bibliotheken

| Werkzeug | Stärkster Hebel | Passung / Grenze |
| --- | --- | --- |
| [Spector.js](https://github.com/BabylonJS/Spector.js) | WebGL-Frame-Capture, Drawcalls, Shader und Texturen inspizieren. | **Erster Schritt vor jedem Look-Pass.** Reines Diagnosewerkzeug; hilft zu entscheiden, ob weitere Materialien oder Passes bezahlbar sind. |
| [glTF Transform](https://github.com/donmccurdy/glTF-Transform) | glTF prüfen, deduplizieren, quantisieren und mit Meshopt/Draco/Texturkompression optimieren. | **Pflicht, falls Blender-Assets kommen.** Als Offline-CLI nutzen; Terras heutige rein prozedurale Runtime braucht es nicht. |
| [postprocessing](https://github.com/pmndrs/postprocessing) | Effektverkettung mit weniger Fullscreen-Pässen, u. a. Bloom, SMAA, SSAO und Farbkorrektur. | **Nur als isolierter Prototyp.** Terra hat bereits einen EffectComposer; nicht zwei Composer mischen. Zuerst einen bestehenden Pass ersetzen und GPU-Zeit vergleichen. |
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) | Hochwertige Offline-/Progressive-Renderings für Art-Referenzen. | **Nicht für den Editor-Loop.** Gut für „Golden Images“ und Materialreferenzen, ungeeignet für die interaktive große Karte. |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | Schnelle Raycasts und räumliche Geometrieabfragen. | **Technischer Qualitätshebel.** Kann Auswahl und Kollision großer Merges beschleunigen; hebt das Bild nur indirekt durch mehr bezahlbare Detailgeometrie. |

## Empfohlene Reihenfolge

1. **Messwoche:** Chrome DevTools MCP plus Spector.js; für Held-, Kopf- und
   Architekturansicht GPU, Drawcalls, Shader-Kompilierung und Texturspeicher
   protokollieren.
2. **Visueller Vertrag:** Playwright MCP setzt Seed, Tageszeit und Kamera und
   erzeugt feste Referenzbilder. Erst damit werden Look-Änderungen objektiv
   vergleichbar.
3. **Hero-Asset-Pilot:** Schildkrötenkopf oder nationales Schloss in Blender
   MCP modellieren, mit glTF Transform optimieren und gegen die jetzige
   prozedurale Version bei gleicher Bildschirmgröße vergleichen.
4. **Ein Effekt, nicht ein Effektpaket:** SSAO **oder** bessere
   Farbkorrektur aus `postprocessing` prototypisieren. Nur übernehmen, wenn
   Silhouette/Materialtrennung sichtbar gewinnt und das Framebudget hält.
5. **Erst dann Runtime-Architektur ändern:** glTF-Loader, KTX2/Meshopt und BVH
   sind sinnvoll, sobald mehrere externe Hero-Assets den zusätzlichen
   Ladepfad rechtfertigen. Für ein einzelnes Asset wäre das unnötige
   Komplexität.

## Umgesetzter Produktionsweg

Die fünf Schritte sind inzwischen als agentenunabhängige Terra Art Factory
umgesetzt. Der kanonische Ablauf, die `/uweterra`-Prompts, Abnahme-Gates und
CLI-Befehle stehen in `docs/engineering/terra-art-workflow.md`. Blender MCP ist
optional: der reproduzierbare Kern verwendet Blender headless, versionierte
Python-Skripte, JSON-Briefs und normale `pnpm terra:art:*`-Befehle.

## Nicht empfohlen

- Ungeprüfte „Three.js MCP“-Verzeichniseinträge ohne gepflegtes Repository,
  Lizenz, Releases oder nachvollziehbare Tool-Schemas.
- Generative Text-zu-3D-Dienste als direkter Produktionspfad: kostenlose
  Kontingente sind veränderlich, Topologie und Lizenzlage oft ungeklärt und
  die Formensprache driftet gegenüber Terras deterministischem Katalog.
- Ein Wechsel zu React Three Fiber nur wegen dessen Plugin-Ökosystem. Terra ist
  eine funktionierende Vanilla-Three-Anwendung; die Migration wäre wesentlich
  größer als der gestalterische Nutzen.
